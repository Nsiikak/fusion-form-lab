"""Spots contact details in chat messages so they can't be sent (and hides them in old messages).

Built to catch the ways people actually try to slip numbers and handles past a filter:
  phones   0803 123 4567 · +234… · O8O3 (letter O) · zero8zero3 · "eight zero three…" · 0803-one-two-three
  emails   ikenna@gmail.com · ikenna,gmail.com · ikenna gmail com · "ikenna gmail" · ikenna at yahoo · [at]/(dot)
  links    wa.me/… · t.me/… · www.site.com · site.com.ng · facebook.com/…
  social   "whatsapp me" · "my IG is …" · "on facebook" · "follow us on tiktok" · @handles

…while leaving ordinary event talk alone: prices (₦250,000), dates (24/10/2026), times (4pm),
guest counts, addresses ("12 Admiralty Way, Lekki Phase 1") and "call me when you arrive".
"""
import re
from typing import Optional

PLACEHOLDER = "[contact details hidden]"

_NUM_WORDS = {"zero": "0", "oh": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
              "six": "6", "seven": "7", "eight": "8", "nine": "9"}
_NUM_WORD_RE = re.compile(r"zero|one|two|three|four|five|six|seven|eight|nine")

# Email providers: on their own they mean "here's my email"
_PROVIDERS = r"g\s*-?\s*mail|googlemail|yahoo|ymail|hotmail|outlook|icloud|protonmail|proton\s*mail|aol|zoho|yandex|live\s*\.\s*com|msn"
_PROVIDER_RE = re.compile(rf"(?<![a-z])(?:{_PROVIDERS})(?![a-z])", re.I)

# name @ / at / , / space  domain  . / dot / , / space  tld
_EMAIL_RE = re.compile(
    r"[a-z0-9][\w.+-]*\s*(?:@|\(at\)|\[at\]|\{at\}|\bat\b|,)\s*[a-z0-9-]+\s*(?:\.|\(dot\)|\[dot\]|\bdot\b|,)\s*"
    r"(?:com|net|org|ng|co|io|me|edu|gov|info|biz)\b", re.I)

# Any web address or bare domain (plagohive links are fine)
_TLDS = r"com|net|org|ng|co|io|me|biz|info|africa|app|store|shop|online|site|xyz|link|ly|gg|tv"
_LINK_RE = re.compile(rf"(?:https?://|www\.)\S+|\b[a-z0-9][a-z0-9-]*\s*\.\s*(?:{_TLDS})(?:\s*\.\s*[a-z]{{2}})?\b(?:/\S*)?", re.I)
_SAFE_LINK_RE = re.compile(r"plagohive", re.I)

_HANDLE_RE = re.compile(r"(?<![\w.])@\s?[a-z0-9_.]{3,}", re.I)

# Messaging apps: any mention is an attempt to move the conversation off Plagohive
_MESSAGING_RE = re.compile(r"\b(?:whats\s*app|watsapp|whatsap|wassap|watsap|w\.?a\.?\s*me|telegram|signal\s+me|imo\b|viber)\b", re.I)

# Social platforms: blocked when paired with possession, an invitation or a handle
_SOCIAL = r"instagram|insta|ig|snapchat|snap|tiktok|tik\s*tok|facebook|fb|twitter|x\s*\.\s*com|linkedin|threads"
_SOCIAL_RE = re.compile(
    rf"\b(?:my|our|on|via|through|follow(?:\s+(?:me|us))?|find\s+(?:me|us)|add\s+(?:me|us)|dm(?:\s+(?:me|us))?|message\s+(?:me|us)|check)\s+(?:on\s+)?(?:{_SOCIAL})\b"
    rf"|\b(?:{_SOCIAL})\b\s*(?:handle|page|account|name|id|is|:|-|@)\s*[a-z0-9_.@]{{2,}}", re.I)

_PHONE_RE = re.compile(r"(?:234|0)[789][01]\d{8}")
_INTL_RE = re.compile(r"(?:^|\D)(?:\+|00)\s*\d(?:[\s\-.()]*\d){8,}")


def _digit_stream(text: str) -> list[str]:
    """Turn a message into runs of digits, reading number words and look-alike letters as digits.
    A run continues across spaces and punctuation and breaks at any real word."""
    runs, cur = [], ""
    for raw in re.split(r"[\s,;:/\\|()\[\]{}\-_.+*'\"]+", text.lower()):
        if not raw:
            continue
        tok = raw
        if tok in _NUM_WORDS:
            cur += _NUM_WORDS[tok]
            continue
        # "zero8zero3", "eightzero3": number words glued to digits
        glued = _NUM_WORD_RE.sub(lambda m: _NUM_WORDS[m.group(0)], tok)
        if re.fullmatch(r"[\dol|i]+", glued) and re.search(r"\d", glued):
            # look-alike letters inside a digit token: O→0, l/I/|→1  ("O8O3", "08O3")
            cur += glued.replace("o", "0").replace("l", "1").replace("i", "1").replace("|", "1")
            continue
        if cur:
            runs.append(cur)
        cur = ""
    if cur:
        runs.append(cur)
    return runs


def classify(text: str) -> Optional[str]:
    """Return what kind of contact detail the text contains ('phone', 'email', 'link', 'social', 'handle'), or None."""
    t = text or ""
    runs = _digit_stream(t)
    # full numbers, or a 10-digit mobile given without its leading 0 ("803 123 4567")
    if _INTL_RE.search(t) or any(_PHONE_RE.search(r) or re.fullmatch(r"[789][01]\d{8}", r) for r in runs):
        return "phone"
    if _EMAIL_RE.search(t) or _PROVIDER_RE.search(t):
        return "email"
    for m in _LINK_RE.finditer(t):
        if not _SAFE_LINK_RE.search(m.group(0)) and not re.fullmatch(r"\d+(?:\s*\.\s*\d+)+", m.group(0)):
            return "link"
    if _MESSAGING_RE.search(t) or _SOCIAL_RE.search(t):
        return "social"
    if _HANDLE_RE.search(t):
        return "handle"
    return None


def find_contact(text: str) -> bool:
    return classify(text) is not None


def mask(text: str) -> str:
    return PLACEHOLDER if find_contact(text) else text


def mask_contact(text: str) -> str:
    """Older messages that contain contact details are shown as a placeholder to both parties."""
    return mask(text)
