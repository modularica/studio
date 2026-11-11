# Kelime Düellosu (lab/kelime-tenisi): builds src/words.js (Turkish and English word lists) from the sources below.
#
#   python3 lab/kelime-tenisi/src/tools/words.py <cache-dir>
#
# The cache dir must hold (download once):
#   master-dictionary.dict, non-tdk.dict  Zemberek-NLP Turkish lexicon (Apache-2.0)
#       https://raw.githubusercontent.com/ahmetaa/zemberek-nlp/master/morphology/src/main/resources/tr/master-dictionary.dict
#       https://raw.githubusercontent.com/ahmetaa/zemberek-nlp/master/morphology/src/main/resources/tr/non-tdk.dict
#   enable1.txt                           ENABLE word list (public domain)
#       https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt
#   naughty-tr.json, naughty-en.json      LDNOOBW lists from the npm package naughty-words (CC-BY-4.0),
#                                         only used here to drop words; nothing from them is shipped
# and `pip install wordfreq` (frequencies, data CC-BY-SA 4.0) decides which words are "common".
# Turkish inflected forms need `pip install zemberek-python` (Zemberek's analyzer, Apache-2.0); the first run
# checks every 3-4 letter string (~4 min) and caches the result as tr-forms.json in the cache dir.
#
# Output per language and word length (3, 4, 5):
#   common  words most people know: the bot plays these, serves come from these, the end-of-point
#           reveal shows these first
#   rare    other valid dictionary words: accepted when a player types them, never played by the bot
#   serve   common words with plenty of common neighbours (a rally can start) and nothing unpleasant
# Turkish: dictionary headwords, circumflex letters folded (kâr -> kar), plus EXTRA below (derived words
#          such as ünlü, uçuş, okçu that Zemberek builds by rule). Under `x` the same three lists for the
#          "inflected words count" rule (evde, aldı, bana), only the forms that are not dictionary words,
#          and `root`: the dictionary word each of them comes from (aldı:almak), shown in the game.
# English: every ENABLE word, inflections included (cats, ran), as in most word games.
import json, os, sys, collections, itertools
from wordfreq import zipf_frequency

CACHE = sys.argv[1] if len(sys.argv) > 1 else '/tmp/kt-data'
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'words.js')
STATS = os.path.join(HERE, 'stats.json')

ALPHA = {
    'tr': 'abcçdefgğhıijklmnoöprsştuüvyz',
    'en': 'abcdefghijklmnopqrstuvwxyz',
}
LENGTHS = (3, 4)            # 5 letters is too sparse in Turkish (avg 1.6 common neighbours)
COMMON_ZIPF = {'tr': 3.0, 'en': 3.0}     # wordfreq Zipf scale: 3 = once per million words
SERVE_ZIPF = {'tr': 3.6, 'en': 3.6}      # serves: well-known words only
SERVE_MIN_NEIGHBOURS = 4                 # common one-letter neighbours a serve word needs

# Never accepted: family game, plus English words and typos that slipped into the Turkish lexicon.
# On top of the LDNOOBW lists.
BLOCK = {
    'tr': '''piç piçi ibne puşt puşta gavat kahpe kevaşe zenci kıro bok boklu yarak sikik siktir amcı çük seks
             chat food fuel homo klüp knot mode rand traş yaaa aaa haa ooo yoo yaa hmm hah idea fast oil run
             ski meal main mesh mail bold done''',
    'en': '''fags fagot dicks cunts twats sluts whore whores rapes raped raper rapist porns tits titty
             poofs spics kikes coons gook gooks chink wop wops dago dagos dyke dykes homo homos jap japs gyp gyps
             gypsy spaz tard tards wank wanks jism jizz piss pissy prick cocks dildo bitch nazi nazis
             negro sexed sexes sexy horny jew jews turk turks mick micks''',
}
# Valid, but not "common": the bot never plays them and serves never use them. Archaic, technical,
# religious or ethnic terms, interjections, abbreviations, words whose frequency comes from another
# word (inflected forms in Turkish, first names in English). Reviewed by hand (Nov 2026).
NOT_COMMON = {
    'tr': '''aba abd abe abs abu aha ahi ahu aka aks akı ala alg ali alp arp arş asa ask ast ası ate ati ayn aza azı
             bad ban bed bip bis bom bop bre bun car cem cim cuk cup cüz cık dah deh dek dem dna dok döl dük dun dvd
             ece eda ede edi efe ege eko ela erk fak fer ful gal gam gem gey gez giz gut güm hac hav hay hor hun hım
             ide ifa ila iti iye jak kah kem kep ket kip kom kul kür küt lak lal lam lan ley lim lir lor los mah mai
             mam mas mes met mey mim mir mis mol nah nam nan nas nev oba oha ohm ole ons ora org pal pik pir pos pub
             pür ram rey rom rot sek sem ser sim sit som sur sut sör tab tal tar tav tik tim tin tor tüh tük ufo vah
             vay vız yad yal yek ytl yuh zat zen zer zum zıp zır çüş öcü öge örf örs öze üre ıra şad şak şap şer şıp
             ağı aya ari arz art ağa bat bek bet bor bul din dua duy had har haz haç ini kal kam kay kes keş kut kıç
             men muş par per sak sam say sin tak tem vaz vip yak zan çak çal çar çat çöz ırk şek ant ark kdv
             anti arge dada esma euro feyz iken kobi orda pers regl slot yuan
             abuk acar acem acun adem ahir ahit akar akil akit aksu akut akça akçe alto amel amin amma amme anal
             anaç anca anüs aort apak araf arap araz arda arif arya arık asar asım ataş atik atıl atım aval avam
             avaz ayet ayin ayla ayni ayça ayın açar açım aşar bade badi baha baki bakı bala bara barı bası bağa
             bağı bebe beka beli berk besi beze biat bide bili bini bişi boca bono briç bula bura buse böke böle
             bölü caiz cana cani cari cebe celp cenk daim dane dank dara darp data debi deme dimi dine dini dink
             done doru dudu düze ecel ecza eder edim edip edna ehil ehli elde elem elif elim emen emme emmi eren
             eril erim eros esen esim eter etil evin ezan ezel ezik faik fail fani fars farz fert feza fink flor
             fırt gale gama gang gani garp gayr gaza gele gidi gine guru gömü görü göze göçü günü gına hacı haiz
             halt hami hara hare hart haya haşa huşu ibiş ibra icap idam idil ihya ilah illa ilmi imam iman inal
             inan indi irin içim içki jale kadı kaim kala kana kani kant kanı kari karı kesi keza koçu koşa kron
             kula kuma köle köse lake lala lenf lift liga linç liva maki mask meme meni meri meta meşk mika mira
             morg müge nail name nato nebi nere neva nida nisa nova oley omur onar onat oral oruç oyum oğuz pare
             pars pepe peso pike popo raks rami reha reva rika ritm riya saba sair saki sala sanı sapa sara sari
             sava saya sağı seda seki sela sema semi sena sevi sima sine sofi soma sual sufi sulh suna sure söve
             taka tali tart topu toto trap tutu türe ulak ulan ulvi umar umre umum umur utku uyur uçar uğra vaaz
             vaiz vere vira vuku yatı yağı yaşa zati zina ziya zona çağa çeki çita ören özge üste üzme üzre ısın
             ışıl şark şems şerh şeyh şile şirk şule şura talk slip
             eriş eşme ilme itiş otsu''',
    'en': '''aba aga ain ais ala als ama ani ars att bal bas bey bis bod bos cis col cor cox coz dah dak daw dey dis
             dos dow dui dup ecu eff ems eng ers eta eth fas fer fil goa hae haw hes het hon hoy ich ids ifs ins jin
             jun jus kos lac las lat lei lex lis luv mas med mig mir mis mol mon mor mos mot mun mus nam naw nee nom
             nos obi ons ops pac pas pax pes pol pom ras rec rei rem res ria rin roc sae sec sen ser sha sri syn tae
             tas tau tel tho til tis tor tsk ump vas vee wen wha wis wot yeh god gods
             aero agar alba alfa amin anil ares bach berg cain chao comp dada dahl dang eyre fuji hogg howe hong
             joss kami kemp kern lakh lang lear lees lima luna mach maya mays modi mott ness nite offs parr ritz
             sera sept shri sims tele ting toro tung twas yang mons ling olds secs shes imam hajj libs
             ami ana ava ave bel ben deb dee del dev dex dom dun fay gan joe kat kay ken lea lee lev lib lin mac mae
             mel mil nan ole ora pam pia reg rex sal sim sol tam ted tod wat zed
             abba alan alec alma anna axel beth brad bree brit carl carr cate chad cobb cole conn cory dirk duff
             gage gran hart holt jake jane jess jill jock joey john josh kane kent kirk kris lars linn lowe lulu
             mack marc matt maud maxi meta mike milo mina mora mort nada noel otto pooh rand rees rhea rick rolf
             rudd ruth saul scot shaw shay shea tate toby tony tori tory trey tyne vail vera vita viva whit wynn
             ariel benny billy bobby brent britt brock buffy burke butch chevy chico colin costa derry devon donna
             emery erica ester fanny fritz garth hogan jenny jerry jesse jimmy judas kelly kerry lacey laird laura
             lefty leone levin logan louie louis marge maria merle missy moira monte morse nancy natal nelly paddy
             patsy patty pedro perry peter ralph randy riley roger romeo sally serge shawn silva sissy sonny tammy
             terra terry tommy wally weber welch willy''',
}
# Never served (function words, archaic or abstract ones that make a dull first shot).
SERVE_SKIP = {
    'tr': '''akli alim ayan bari beri bile daha defa gene hale hani hele kont mana mani mark mars olur paha razı
             safa sefa sarf sırf suni yani yana ait ama bey biz her hem hep hey hop kez kim pek pes sen siz var yok
             çok şey ben adi''',
    'en': '''thee hath cant mans hers oops nope hmm huh heh nah sic thy the and nor was has had his her him she
             its for are did does done than that them then they were what when your thin been gets said says''',
}
# Accepted when a player types them, but the bot, the serves and the reveal never use them.
SOFT = {
    'tr': '''ölü ölüm ölmek ölme ölüş kan kanlı silah bomba ceset katil şarap rakı bira votka esrar eroin kokain
             salak aptal ahmak enayi ebleh avanak dangalak hıyar öküz domuz geber gebe gebeş leş kusmuk
             kusmak sıçan sıçmak osur osuruk işemek çiş kaka bok götür''',
    'en': '''kill kills dead die died dies dying gun guns bomb bombs stab stabs blood bloody gore murder
             drug drugs beer beers wine wines rum gin vodka booze drunk weed crack meth stupid idiot moron
             dumb dumbo puke pukes vomit poop poops pee pees fart farts crap shag hell damn butt butts suck
             sucks nude nudes anal gay gays pimp pimps turd turds arse lewd lust nuke nukes dope puss peed babe
             babes coke coca bong dong bum bums''',
}

# Derived words Zemberek's lexicon does not list because its morphology builds them from the root:
# -lI (ünlü, etli), -CI (okçu, sucu), -mA (alma, yeme), -Iş (uçuş, iniş), -sI (otsu), -CA (azca).
# Found with Zemberek's analyzer (pip zemberek-python) on 3-4 letter words, keeping only analyses that
# are root + these suffixes with no inflection, and only words that also have an entry in Turkish
# Wiktionary's word list (Vikisözlük, CC-BY-SA; collected in github.com/mertemin/turkish-word-list);
# wrong-root analyses (aklı = ak+lı, pili = pi+li) dropped by hand (Nov 2026).
EXTRA = {
    'tr': '''adlı akma akış allı alma arlı atlı atma atçı atış aylı ayma azca azma açış ağcı ağlı ağma ağsı ağış
             aşma ekme elci emiş enli erce eriş erme esme etli etme etçi evci ezme eğiş eğme eşli eşme ilme iniş
             ipsi ipçi isli itiş itme içiş içli içme iğci işli nece okçu olma oluş onlu onma otlu otsu otçu ovma
             oyma oyuş sucu sıma umma uncu usçu utlu utma utçu uyma uçlu uçma uçuş yeme ölme ölüş öpme öpüş örme
             örüş ötme ötüş övme övüş özlü öçlü ünlü ütme üçlü üşme''',
    'en': '',
}

def fold_tr(w):
    return w.replace('â', 'a').replace('î', 'i').replace('û', 'u').replace('ô', 'o')

def load_tr():
    words = {}
    for fn in ('master-dictionary.dict', 'non-tdk.dict'):
        for line in open(os.path.join(CACHE, fn), encoding='utf-8'):
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            head, _, attrs = line.partition('[')
            head = head.strip()
            if ' ' in head or 'Punc' in attrs or 'Prop' in attrs or 'Abbrv' in attrs or 'P:Dup' in attrs:
                continue
            if 'Ext' in attrs and 'Interj' in attrs:   # aa, hmm, yaaa ...
                continue
            w = fold_tr(head.lower())
            if not all(c in ALPHA['tr'] for c in w) or not any(c in 'aeıioöuü' for c in w):
                continue
            z = max(zipf_frequency(head, 'tr'), zipf_frequency(w, 'tr'))
            words[w] = max(words.get(w, 0), z)
    return words

def load_en():
    words = {}
    for line in open(os.path.join(CACHE, 'enable1.txt'), encoding='utf-8'):
        w = line.strip().lower()
        if w and all(c in ALPHA['en'] for c in w) and len(w) <= max(LENGTHS):
            words[w] = zipf_frequency(w, 'en')
    return words

def naughty(lang):
    out = set()
    for w in json.load(open(os.path.join(CACHE, f'naughty-{lang}.json'), encoding='utf-8')):
        w = w.strip().lower()
        if ' ' not in w:
            out.add(fold_tr(w) if lang == 'tr' else w)
    return out


# ---------- Turkish inflected forms ----------
VOWELS_TR = set('aeıioöuü')
SKIP_POS = {'Punctuation', 'Unknown', 'Duplicator', 'Interjection', 'Question'}
SKIP_SEC = {'ProperNoun', 'Abbreviation', 'RegularAbbreviation', 'Email', 'Url', 'Mention', 'HashTag', 'Emoticon',
            'RomanNumeral', 'Date', 'Clock', 'Percentage', 'Ratio', 'Range', 'Real', 'Distribution'}
# Turkish letters often typed without their marks online (paşa -> pasa): such a spelling's frequency is mostly
# the other word's, so an inflected form whose marked spelling is at least as frequent is not "common".
ASCII_TR = {'c': 'ç', 'g': 'ğ', 'i': 'ı', 'o': 'ö', 's': 'ş', 'u': 'ü'}
# Inflected forms that look frequent but are not what people mean by them, reviewed by hand (Nov 2026).
COMMON_ZIPF_FORMS = 3.3   # an inflected form must be a bit more frequent than a dictionary word to count as known
NOT_COMMON_FORMS = '''den yada emre roma şuan deki erdi teki ili bolu baya anki buda time sun min kate tuna inin
    özer life del lana buca ren zara ilin inde pete nün bine nede ine here side erer ger anıl urla len aram söke
    üncü doya anlı mili eyle eri ula alla aksa demi itin piri dom usa azmi ünde timi dür erin nuru pen gere yala
    yor unda tele öner ıran garı geni fin kon kop yet nana apar bert rene biti emil eni bele dükü buy geli kıçı
    anar fili anan aran ecem sisi anım azam eken ever imi else tona ayki tap egon lime lem rem emer iter kiti üzer
    fine alı yum ağar cara hama imiz tama sın haçı tiki adla dola üsse mora uma uza sına arzı bulu dona rama evle
    jeti pine ekte tipe tene tırı kiki tora uman çıka asra azda beki dura etle mata koda okun tamı yata ölün bur
    bene sama çeke sız açız inim silk ödü daya okla ene jen neme şaş zatı öten emi öpen ite adan arın atta ezin
    ayım ediş hole işti nen öve ahde dire mele odan toru oka adar ağca fazı puta özün mimi'''

def zemberek_forms():
    """Every 3-4 letter string Zemberek accepts as a Turkish word form, with its analyses
    [pos, secondary pos, lemma, root, copula] (copula: a noun or adjective used as a verb, kar-dı).
    Cached as tr-forms-v2.json in the cache dir."""
    path = os.path.join(CACHE, 'tr-forms-v2.json')
    if os.path.exists(path):
        return json.load(open(path, encoding='utf-8'))
    import types, typing, logging
    shim = types.ModuleType('typing.io')
    shim.TextIO, shim.IO, shim.BinaryIO = typing.TextIO, typing.IO, typing.BinaryIO
    sys.modules.setdefault('typing.io', shim)   # antlr4 4.8, pinned by zemberek-python, imports typing.io (gone in 3.13)
    logging.disable(logging.INFO)
    from zemberek import TurkishMorphology
    morph = TurkishMorphology.create_with_defaults()
    out = {}
    for n in LENGTHS:
        for t in itertools.product(ALPHA['tr'], repeat=n):
            if not VOWELS_TR.intersection(t):
                continue
            w = ''.join(t)
            res = []
            for r in morph.analyze(w).analysis_results:
                if r.is_unknown() or r.is_runtime():
                    continue
                it = r.item
                if it.primary_pos.name in SKIP_POS or it.secondary_pos.name in SKIP_SEC:
                    continue
                copula = 1 if 'Zero→Verb' in r.format_string() else 0
                res.append([it.primary_pos.name, it.secondary_pos.name, it.lemma, it.root, copula])
            if res:
                out[w] = res
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False)
    return out

def marked_variants(w):
    """w with some of c g i o s u replaced by ç ğ ı ö ş ü (w itself excluded)."""
    pos = [i for i, c in enumerate(w) if c in ASCII_TR]
    for k in range(1, len(pos) + 1):
        for sub in itertools.combinations(pos, k):
            yield ''.join(ASCII_TR[c] if i in sub else c for i, c in enumerate(w))

def inflected_tr(valid, bad, soft, known):
    """Inflected forms that are not dictionary words: {form: (root shown or None, soft only)}.
    A form counts only if it has an analysis whose root is not a blocked word (göte, siki never count)."""
    fold = lambda x: fold_tr(x.lower())
    out = {}
    for w, res in zemberek_forms().items():
        if w in valid or w in bad:
            continue
        clean = [r for r in res if fold(r[2]) not in bad and fold(r[3]) not in bad]
        if not clean:
            continue
        soft_only = all(fold(r[2]) in soft or fold(r[3]) in soft for r in clean)
        # Root shown to players only when the analyses agree (aldı: almak). "Was a ..." readings of nouns
        # (al-dı: it was red) do not count against that when there is another reading.
        plain = [r for r in clean if not r[4]] or clean
        roots = {fold(r[2]) for r in plain}
        out[w] = (roots.pop() if len(roots) == 1 else None, soft_only)
    return out

def buckets(ws):
    b = collections.defaultdict(list)
    for w in ws:
        for i in range(len(w)):
            b[w[:i] + '_' + w[i + 1:]].append(w)
    return b

def neighbours(w, b):
    out = []
    for i in range(len(w)):
        out += [x for x in b[w[:i] + '_' + w[i + 1:]] if x != w]
    return out

def lists(valid, allw, lang, soft, notc, serve_from=None):
    """common / rare / serve for one word set. serve_from: the words serves may come from (default common)."""
    common = [w for w in valid if allw[w] >= COMMON_ZIPF[lang] and w not in soft and w not in notc]
    cset = set(common)
    rare = [w for w in valid if w not in cset]
    bc, bv = buckets(common), buckets(valid)
    ncount = {w: len(neighbours(w, bc)) for w in common}
    skip = set(SERVE_SKIP[lang].split())
    pool = serve_from if serve_from is not None else common
    serve = [w for w in pool if allw[w] >= SERVE_ZIPF[lang] and ncount.get(w, 0) >= SERVE_MIN_NEIGHBOURS
             and w not in skip]
    st = {
        'valid': len(valid), 'common': len(common), 'serve': len(serve),
        'avg_common_neighbours': round(sum(ncount.values()) / max(1, len(common)), 2),
        'common_with_0_common_neighbours': sum(1 for w in common if ncount[w] == 0),
        'common_with_0_valid_neighbours': sum(1 for w in common if len(neighbours(w, bv)) == 0),
        'common_with_1_2': sum(1 for w in common if 1 <= ncount[w] <= 2),
        'common_with_5_plus': sum(1 for w in common if ncount[w] >= 5),
    }
    return common, rare, serve, st

def main():
    data, stats = {}, {}
    for lang, loader in (('tr', load_tr), ('en', load_en)):
        allw = loader()
        for w in EXTRA[lang].split():
            allw[w] = max(allw.get(w, 0), zipf_frequency(w, lang))
        bad = naughty(lang) | set(BLOCK[lang].split())
        soft = set(SOFT[lang].split())
        notc = set(NOT_COMMON[lang].split())
        data[lang] = {'alpha': ALPHA[lang], 'common': {}, 'rare': {}, 'serve': {}}
        stats[lang] = {}
        valid_all = {w for w in allw if len(w) in LENGTHS and w not in bad}
        for n in LENGTHS:
            valid = sorted(w for w in valid_all if len(w) == n)
            common, rare, serve, st = lists(valid, allw, lang, soft, notc)
            data[lang]['common'][n] = ' '.join(common)
            data[lang]['rare'][n] = ' '.join(rare)
            data[lang]['serve'][n] = ' '.join(serve)
            stats[lang][n] = st
        if lang != 'tr':
            continue
        # Rule "inflected words count": the dictionary plus every form Zemberek accepts (evde, aldı, bana).
        forms = inflected_tr(valid_all, bad, soft, allw)
        known = dict(allw)
        for w in forms:
            known[w] = zipf_frequency(w, 'tr')
        notc_forms = set(NOT_COMMON_FORMS.split()) | {w for w in forms if known[w] < COMMON_ZIPF_FORMS}
        inflated = {w for w in forms if any((v in valid_all or v in forms) and zipf_frequency(v, 'tr') >= known[w]
                                            for v in marked_variants(w))}
        soft_forms = {w for w, (_, s_only) in forms.items() if s_only}
        x = {'common': {}, 'rare': {}, 'serve': {}}
        stats['tr-x'] = {}
        for n in LENGTHS:
            dict_valid = [w for w in valid_all if len(w) == n]
            valid = sorted(dict_valid + [w for w in forms if len(w) == n])
            common, rare, _, st = lists(valid, known, 'tr', soft | soft_forms, notc | notc_forms | inflated)
            dict_common = set(data['tr']['common'][n].split())
            _, _, serve, _ = lists(valid, known, 'tr', soft | soft_forms, notc | notc_forms | inflated,
                                   serve_from=[w for w in common if w in dict_common])
            x['common'][n] = ' '.join(w for w in common if w in forms)
            x['rare'][n] = ' '.join(w for w in rare if w in forms)
            x['serve'][n] = ' '.join(serve)
            st['serve'] = len(serve)
            st['forms'] = sum(1 for w in forms if len(w) == n)
            stats['tr-x'][n] = st
        x['root'] = ' '.join(f'{w}:{forms[w][0]}' for w in sorted(forms) if forms[w][0])
        data['tr']['x'] = x
        # for review: inflected forms the bot may play, most frequent first
        review = sorted((w for n in LENGTHS for w in x['common'][n].split()), key=lambda w: -known[w])
        with open(os.path.join(CACHE, 'tr-forms-common.txt'), 'w', encoding='utf-8') as f:
            f.write('\n'.join(f'{w}\t{known[w]:.2f}\t{forms[w][0] or "?"}' for w in review))
    js = ('// Generated by tools/words.py. Do not edit by hand.\n'
          '// Turkish: Zemberek-NLP lexicon and analyzer (Apache-2.0) + derived words found in Turkish Wiktionary (CC-BY-SA).\n'
          '// English: ENABLE (public domain).\n'
          '// "common" = wordfreq Zipf >= 3 (wordfreq data CC-BY-SA 4.0).\n'
          'const WORDS = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(js)
    with open(STATS, 'w', encoding='utf-8') as f:
        json.dump(stats, f, indent=1)
    print(json.dumps(stats, indent=1))
    print(OUT, round(len(js.encode('utf-8')) / 1024), 'KB')

if __name__ == '__main__':
    main()
