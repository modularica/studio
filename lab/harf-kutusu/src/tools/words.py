#!/usr/bin/env python3
"""Builds src/words.txt: the words a board can hide, for the end-of-round list on the page.

    pip install wordfreq
    python3 lab/harf-kutusu/src/tools/words.py <cache-dir>

Same sources and family filters as Kelime Düellosu (its lab/kelime-tenisi/src/tools/words.py is imported):
the cache dir holds master-dictionary.dict and non-tdk.dict (Zemberek-NLP, Apache-2.0) and naughty-tr.json
(npm naughty-words, only used to drop words); download links at the top of that script.

Words, 3..MAXLEN letters:
  - dictionary headwords (no proper names, abbreviations or interjections; circumflex folded: kâr -> kar)
  - Kelime Düellosu's EXTRA derived words (ünlü, uçuş, okçu)
  - the root of every -mek verb, the bare command form (GEL, OKU, TEMİZLE); NOT_ROOTS skipped
Left out: BLOCK and LDNOOBW words, and SOFT words (valid, but a reveal never shows them, as in
Kelime Düellosu: violence, alcohol, insults, toilet). A verb's root shares its verb's fate.
Known words get a trailing "." : wordfreq Zipf >= 3, minus NOT_COMMON (Kelime Düellosu's hand-picked list of
valid but little-known words). The root of a common verb is known even when NOT_COMMON lists its noun reading
(KAL, TAK, ART, KES), unless NOT_COMMON_ROOTS names it.
Output: one word per line in Turkish capitals (i -> İ, ı -> I), sorted by code point; the page binary-searches it.
"""
import os
import sys

from wordfreq import zipf_frequency

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', 'kelime-tenisi', 'src', 'tools'))
import words as kt  # noqa: E402  (Kelime Düellosu's word tool: sources, BLOCK, SOFT, NOT_COMMON, EXTRA)

MAXLEN = 12           # longer words practically never fit on a 4x4 or 5x5 board
KNOWN_ZIPF = 3.0
OUT = os.path.join(HERE, '..', 'words.txt')


def upper_tr(w):
    return ''.join({'i': 'İ', 'ı': 'I'}.get(c, c.upper()) for c in w)


def verbs(cache):
    """Infinitives in the dictionary: -mek/-mak entries without a part-of-speech tag (nouns say [P:Noun])."""
    out = set()
    for fn in ('master-dictionary.dict', 'non-tdk.dict'):
        for line in open(os.path.join(cache, fn), encoding='utf-8'):
            head, _, attrs = line.strip().partition('[')
            head = kt.fold_tr(head.strip().lower())
            if head.endswith(('mek', 'mak')) and ' ' not in head and 'P:' not in attrs:
                out.add(head)
    return out


def main():
    cache = sys.argv[1] if len(sys.argv) > 1 else '/tmp/kt-data'
    kt.CACHE = cache
    zipf = kt.load_tr()                          # {word: Zipf}
    for w in kt.EXTRA['tr'].split():
        zipf[w] = max(zipf.get(w, 0), zipf_frequency(w, 'tr'))
    bad = kt.naughty('tr') | set(kt.BLOCK['tr'].split())
    soft = set(kt.SOFT['tr'].split())
    notc = set(kt.NOT_COMMON['tr'].split()) | set(kt.NOT_COMMON_ROOTS.split())
    common_roots = set()
    skip = set(kt.NOT_ROOTS.split())
    alpha = set(kt.ALPHA['tr'])

    for verb in verbs(cache):
        root = verb[:-3]
        if len(root) < 3 or root in skip or not all(c in alpha for c in root):
            continue
        if verb in bad or root in bad:
            bad.add(root)
            continue
        if verb in soft:
            soft.add(root)
        zv = zipf_frequency(verb, 'tr')
        zipf[root] = max(zipf.get(root, 0), zv)
        if zv >= KNOWN_ZIPF and root not in kt.NOT_COMMON_ROOTS.split():
            common_roots.add(root)

    lines, known, total = [], 0, 0
    for w, z in zipf.items():
        if not 3 <= len(w) <= MAXLEN or w in bad or w in soft:
            continue
        k = (z >= KNOWN_ZIPF and w not in notc) or w in common_roots
        lines.append(upper_tr(w) + ('.' if k else ''))
        known += k
        total += 1
    lines.sort()
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    size = os.path.getsize(OUT)
    print(f'{OUT}: {total} words, {known} known, {size // 1024} KB')


if __name__ == '__main__':
    main()
