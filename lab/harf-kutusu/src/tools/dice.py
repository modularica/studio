#!/usr/bin/env python3
"""Measures the dice in ../dice.json: how many known words a random board hides.

    pip install wordfreq zemberek-python
    python3 lab/harf-kutusu/src/tools/dice.py            # 4x4 and 5x5, minimum 3 letters
    python3 lab/harf-kutusu/src/tools/dice.py --min 4

Words: Zemberek dictionary entries (no proper names or abbreviations, circumflex dropped) plus verb roots
and infinitives (GEL, GELMEK), the same rule as the page's rules sheet. "Known" = wordfreq Zipf >= 3.
Only lexicon.csv is read, so zemberek-python does not need to import (it fails on Python 3.13).
"""
import argparse
import json
import pathlib
import random
import site
import sys

from wordfreq import zipf_frequency

HERE = pathlib.Path(__file__).resolve().parent
ALPHA = "abcçdefgğhıijklmnoöprsştuüvyz"
VOW = set("aeıioöuü")
PTS = {3: 1, 4: 1, 5: 2, 6: 3, 7: 5}


def lexicon_path():
    for d in site.getsitepackages() + [site.getusersitepackages()]:
        p = pathlib.Path(d) / "zemberek" / "resources" / "lexicon.csv"
        if p.exists():
            return p
    sys.exit("zemberek-python not found: pip install zemberek-python")


def words():
    valid, known = set(), set()
    norm = str.maketrans({"â": "a", "î": "i", "û": "u"})
    for line in lexicon_path().open(encoding="utf-8"):
        row = line.rstrip("\n").split("\t")
        if len(row) < 5:
            continue
        lemma, pos, sec = row[1], row[3], row[4]
        if sec in ("Prop", "Abbrv") or pos in ("Punc", "Dup") or lemma[:1] != lemma[:1].lower():
            continue
        lemma = lemma.translate(norm)
        if not all(c in ALPHA for c in lemma):
            continue
        forms = [lemma]
        if pos == "Verb" and lemma[-3:] in ("mak", "mek") and len(lemma) > 4:
            forms.append(lemma[:-3])
        z = zipf_frequency(lemma, "tr")
        for w in forms:
            if len(w) >= 3:
                valid.add(w)
                if z >= 3.0:
                    known.add(w)
    return valid, known


def neighbours(n):
    return [[(r + dr) * n + c + dc for dr in (-1, 0, 1) for dc in (-1, 0, 1)
             if (dr or dc) and 0 <= r + dr < n and 0 <= c + dc < n]
            for r, c in (divmod(i, n) for i in range(n * n))]


def solve(board, nb, prefixes, valid, minlen):
    found = set()

    def dfs(i, s, used):
        s += board[i]
        if s not in prefixes:
            return
        if len(s) >= minlen and s in valid:
            found.add(s)
        used |= 1 << i
        for j in nb[i]:
            if not (used >> j) & 1:
                dfs(j, s, used)

    for i in range(len(board)):
        dfs(i, "", 0)
    return found


def lower(s):
    return "".join({"İ": "i", "I": "ı"}.get(c, c.lower()) for c in s)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min", type=int, default=3)
    ap.add_argument("--boards", type=int, default=2000)
    a = ap.parse_args()
    valid, known = words()
    prefixes = {w[:i] for w in valid for i in range(1, len(w) + 1)}
    print(f"{len(valid)} dictionary words, {len(known)} known")
    dice = json.loads((HERE.parent / "dice.json").read_text(encoding="utf-8"))
    rng = random.Random(2026)
    for n, ds in dice.items():
        n = int(n)
        ds = [lower(d) for d in ds]
        faces = sum(len(d) for d in ds)
        vowels = sum(c in VOW for d in ds for c in d)
        nb, kn, va, pt = neighbours(n), [], [], []
        for _ in range(a.boards if n == 4 else a.boards // 3):
            order = rng.sample(ds, len(ds))
            board = [d[rng.randrange(6)] for d in order]
            f = solve(board, nb, prefixes, valid, a.min)
            k = [w for w in f if w in known]
            kn.append(len(k)); va.append(len(f)); pt.append(sum(PTS.get(len(w), 11) for w in k))
        kn.sort()
        m = len(kn)
        print(f"{n}x{n}: {faces} faces, {vowels / faces:.0%} vowels | known words per board: "
              f"mean {sum(kn) / m:.1f}, median {kn[m // 2]}, worst 10% {kn[m // 10]} | "
              f"all dictionary words {sum(va) / m:.1f} | points if one player found every known word {sum(pt) / m:.1f}")


if __name__ == "__main__":
    main()
