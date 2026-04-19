import os
import re
from typing import List, Optional, Tuple

from loader import intent_centroids, intent_vectors, model
from similarity import cosine_similarity

# Below this cosine score, return "none" (reduces wrong intent on random/noisy speech).
# Tune with INTENT_MIN_SCORE env (e.g. 0.28–0.42 for MiniLM).
_MIN_SCORE = float(os.environ.get("INTENT_MIN_SCORE", "0.32"))

# If best − second < this, try lexical rules; if still unclear, return "none" (high precision).
_MIN_MARGIN = float(os.environ.get("INTENT_MIN_MARGIN", "0.045"))


def _has_navigation_keyword(text: str) -> bool:
    t = text.lower()
    return any(
        k in t
        for k in (
            "setting",
            "video",
            "friend",
            "profile",
            "home",
        )
    )


def _negates_opening_navigation(text: str) -> bool:
    t = text.lower()
    if "don't know" in t and "don't open" not in t and "don't want" not in t:
        return False

    if any(
        p in t
        for p in (
            "don't open",
            "dont open",
            "do not open",
            "never open",
            "don't go to",
            "do not go to",
            "won't open",
            "dont go to",
            "don't want to open",
            "don't want to go",
            "don't want",
            "do not want",
            "dont want",
            "not opening",
            "stop opening",
            "avoid opening",
            "don't navigate",
        )
    ):
        return True

    if any(
        p in text
        for p in (
            "لا تفتح",
            "لا تفتحي",
            "لا أريد فتح",
            "لا اريد فتح",
            "ما أريد فتح",
            "بدون فتح",
        )
    ):
        return True

    if any(p in text for p in ("لا أريد", "لا اريد")) and _has_navigation_keyword(text):
        return True

    return False


def _is_open_navigation_intent(intent: str) -> bool:
    return bool(intent) and intent.startswith("open_")


def _rank_intents(text_vector) -> List[Tuple[str, float]]:
    """All intents scored; sorted by score descending."""
    scored: List[Tuple[str, float]] = []
    for intent, vectors in intent_vectors.items():
        s_cent = cosine_similarity(text_vector, intent_centroids[intent])
        s_examples = max(cosine_similarity(text_vector, v) for v in vectors)
        score = max(s_cent, s_examples)
        scored.append((intent, float(score)))
    scored.sort(key=lambda x: -x[1])
    return scored


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9']+", text.lower()))


def _lexical_pair_winner(text: str, a: str, b: str) -> Optional[str]:
    """
    When two intents are embedding-close, use lightweight word cues.
    Returns one of a, b, or None if no safe rule applies.
    """
    t = text.lower()
    w = _tokens(text)

    pair = {a, b}

    # --- previous_post vs open_videos (often confused by STT / embeddings) ---
    if pair == {"previous_post", "open_videos"}:
        # Tab / section: open the videos area
        if re.search(
            r"\b(open|go to|show|visit|browse)\s+(the\s+)?(videos?|reels|clips)\b", t
        ) or re.search(r"\b(videos?|reels)\s+(tab|section|page|feed|screen)\b", t):
            return "open_videos"
        if re.search(
            r"\b(previous|earlier)\s+(post|one|item)\b", t
        ) or re.search(r"\b(last|prior)\s+post\b", t):
            return "previous_post"
        if "previous" in t or re.search(r"\bprev\b", t):
            return "previous_post"
        if re.search(r"\b(go\s+)?back\b", t) and not re.search(
            r"\b(go\s+)?back\s+to\s+(the\s+)?(videos?|reels)\b", t
        ):
            return "previous_post"
        if re.search(r"\b(scroll|move)\s+back\b", t):
            return "previous_post"
        # "video(s)" without scroll-back context → tab
        if re.search(r"\b(videos?|reels|clips)\b", t) and "previous" not in t and not re.search(
            r"\b(prev|back|last|earlier)\b", t
        ):
            return "open_videos"
        return None

    # --- next_post vs open_videos ---
    if pair == {"next_post", "open_videos"}:
        if re.search(r"\b(next|following|skip)\s+(post|one|item)\b", t):
            return "next_post"
        if re.search(
            r"\b(open|go to|show)\s+(the\s+)?(videos?|reels)\b", t
        ) or re.search(r"\b(videos?|reels)\s+(tab|section)\b", t):
            return "open_videos"
        if "next" in w and "video" not in t and "videos" not in t:
            return "next_post"
        return None

    # --- create_post vs like_post ---
    if pair == {"create_post", "like_post"}:
        create_hits = w & {
            "create",
            "make",
            "write",
            "compose",
            "publish",
            "draft",
            "upload",
            "new",
            "add",
            "start",
        }
        like_hits = w & {"like", "heart", "love", "thumbs"}
        if re.search(r"\b(like|heart|love)\s+(this|it|that)\b", t):
            return "like_post"
        if re.search(r"\b(create|make|write|compose|publish)\b", t):
            return "create_post"
        if "thumbs" in t or "thumb" in t:
            return "like_post"
        # "like" alone can be "I'd like to …" — prefer create verbs if present
        if like_hits and create_hits:
            return None
        if like_hits and not create_hits:
            return "like_post"
        if create_hits and not like_hits:
            return "create_post"
        return None

    return None


def _resolve_with_margin(text: str, ranked: List[Tuple[str, float]]) -> Tuple[str, float]:
    """
    Pick intent using score floor + margin; when top-2 are too close, use lexical rules
    or return none for precision.
    """
    if not ranked:
        return "none", 0.0

    best, s1 = ranked[0]
    s2 = ranked[1][1] if len(ranked) > 1 else -1.0

    if s1 < _MIN_SCORE:
        return "none", s1

    if len(ranked) == 1 or (s1 - s2) >= _MIN_MARGIN:
        return best, s1

    # Ambiguous top-2 (or more): try lexical disambiguation between #1 and #2
    second = ranked[1][0]
    picked = _lexical_pair_winner(text, best, second)
    if picked:
        return picked, s1

    # Try #1 vs #3 if #2 didn't help (three-way tie)
    if len(ranked) > 2:
        third = ranked[2][0]
        picked = _lexical_pair_winner(text, best, third)
        if picked:
            return picked, s1
        picked = _lexical_pair_winner(text, second, third)
        if picked:
            return picked, s1

    return "none", s1


def predict(text: str):
    text = (text or "").strip()
    if not text:
        return "", 0.0

    if _negates_opening_navigation(text) and _has_navigation_keyword(text):
        return "none", 1.0

    text_vector = model.encode([text], normalize_embeddings=True)[0]
    ranked = _rank_intents(text_vector)

    best_intent, best_score = _resolve_with_margin(text, ranked)

    if best_intent == "none" or not best_intent:
        return "none", float(best_score)

    if _negates_opening_navigation(text) and _is_open_navigation_intent(best_intent):
        return "none", float(best_score)

    return best_intent, float(best_score)


def _run_quick_eval() -> None:
    """Sanity check after changing intents.json or model — aim for high hit rate."""
    suite = [
        ("I want to create a post", "create_post"),
        ("make a new post please", "create_post"),
        ("show me the next post", "next_post"),
        ("go to the next one in the feed", "next_post"),
        ("previous post", "previous_post"),
        ("go back one post", "previous_post"),
        ("previous", "previous_post"),
        ("open settings for me", "open_settings"),
        ("take me to settings", "open_settings"),
        ("go to videos tab", "open_videos"),
        ("I want to see videos", "open_videos"),
        ("open friends list", "open_friends"),
        ("show my friends", "open_friends"),
        ("go to my profile", "open_profile"),
        ("open my profile page", "open_profile"),
        ("back to home", "open_home"),
        ("go to homepage now", "open_home"),
        ("main feed please", "open_home"),
        ("like this post", "like_post"),
        ("give it a thumbs up", "like_post"),
        ("delete this post", "delete_post"),
        ("remove the post", "delete_post"),
        ("I want to search", "search_person"),
        ("find someone", "search_person"),
        ("asdfgh random noise", "none"),
        ("what is the weather", "none"),
        # Disambiguation stress tests
        ("go back", "previous_post"),
        ("open videos", "open_videos"),
        ("videos tab", "open_videos"),
        ("like it", "like_post"),
        ("create a post", "create_post"),
    ]
    ok = 0
    for text, expected in suite:
        got, score = predict(text)
        hit = got == expected
        ok += int(hit)
        tag = "OK" if hit else "FAIL"
        print(f"[{tag}] {text!r} -> {got} ({score:.3f}) expect {expected}")
    print(f"\nQuick eval: {ok}/{len(suite)} ({100.0 * ok / len(suite):.1f}%)")


if __name__ == "__main__":
    _run_quick_eval()
