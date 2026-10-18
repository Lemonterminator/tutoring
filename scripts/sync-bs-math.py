"""Import the complete BS paper lessons and adapt them to the existing MDX reader.

Chinese source remains authoritative. English prose is translated locally with
protected formulas, numbers, code and URLs; both snapshots live in content/.
Run --import-source --translate once, then rerun without flags to regenerate.
"""
from pathlib import Path
from collections import Counter
import argparse
import hashlib
import html
import json
import os
import re
import shutil
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content" / "bs-math"
PUBLIC = ROOT / "public" / "quant-materials" / "bs-math"
SOURCE = Path(os.environ.get("BS_MATH_ROOT", "C:/Users/Jiang/Documents/Long Way to Quant/Quant_interview"))
LESSONS = [
    ("01_model_and_price", "19-bs-model-price", "P/Q measures, diffusion and BS pricing", "P/Q 测度、扩散与 BS 定价", "Pricing and PDE", 2),
    ("02_delta_gamma", "20-bs-delta-gamma", "Delta and Gamma: slope and curvature", "Delta、Gamma：斜率与曲率", "Pricing and PDE", 1),
    ("03_finite_differences", "21-bs-finite-differences", "Finite differences, floating-point error and PDE grids", "有限差分、浮点误差与 PDE 网格", "Numerical differentiation", 1.5),
    ("04_complex_step", "22-bs-complex-step", "Complex-step and the 45-degree Gamma formula", "Complex-step 与 45° Gamma", "Numerical differentiation", 1),
    ("05_cdf_and_order", "23-bs-cdf-hermite", "Complex CDF, Hermite polynomials and P3", "复数 CDF、Hermite 多项式与 P3", "Numerical differentiation", 1.5),
    ("06_first_order_greeks", "24-bs-first-order-greeks", "Vega, Theta, Rho and dividend sensitivity", "Vega、Theta、Rho 与股息敏感度", "Greeks and puts", 1.5),
    ("07_put_and_parity", "25-bs-put-parity", "Put pricing, parity and Greeks", "Put 定价、平价与 Greeks", "Greeks and puts", 1.5),
    ("08_higher_greeks", "26-bs-higher-greeks", "Higher Greeks, Hessians and IV conditioning", "高阶 Greeks、Hessian 与 IV 条件数", "Higher-order risk", 2),
]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def verify_math_and_code(source, translated, label):
    math = r"\$\$[\s\S]*?\$\$|(?<!\$)\$(?!\$)[^\n$]+\$"
    if Counter(re.findall(math, source)) != Counter(re.findall(math, translated)):
        raise ValueError(f'{label}: mathematical expressions changed or disappeared')
    if re.findall(r'```[\s\S]*?```', source) != re.findall(r'```[\s\S]*?```', translated):
        raise ValueError(f'{label}: code blocks changed or disappeared')


def write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")


def import_sources():
    records = []
    for stem, *_ in LESSONS:
        original = SOURCE / "docs" / "bs_math" / f"{stem}.md"
        data = original.read_bytes()
        normalized = original.read_text(encoding="utf-8")
        write(CONTENT / f"{stem}.zh.md", normalized)
        records.append(dict(source=str(original), destination=f"{stem}.zh.md", sourceSha256=digest(data),snapshotSha256=digest(normalized.encode())))
    assets = CONTENT / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    for original in sorted((SOURCE / "artifacts" / "bs-math").glob("*")):
        if original.suffix in (".png", ".csv"):
            shutil.copy2(original, assets / original.name)
    for original in [SOURCE / "docs" / "bs_math" / "README.md", SOURCE / "docs" / "bs_math" / "numerical_notes.md",
                     SOURCE / "docs" / "complex_cdf_series.md", SOURCE / "docs" / "cdf_performance.md"]:
        shutil.copy2(original, assets / original.name)
    pdfs = assets / "pdf"
    pdfs.mkdir(exist_ok=True)
    for original in sorted((SOURCE / "output" / "pdf" / "black_scholes_math").glob("*.pdf")):
        shutil.copy2(original, pdfs / original.name)
    shutil.copy2(SOURCE / "Quant_Black_Scholes_Greeks_Assignment.pdf", pdfs / "original_assignment.pdf")
    write(CONTENT / "source-index.json", json.dumps(dict(importedFrom=str(SOURCE), lessons=records), ensure_ascii=False, indent=2)+"\n")
    print("Imported all eight complete lessons, six figures, numerical CSVs and printable references.", flush=True)


PROTECT = re.compile(r"\$\$[\s\S]*?\$\$|(?<!\$)\$(?!\$)[^\n$]+\$|```[\s\S]*?```|`[^`\n]+`|!?\[[^\]]*\]\([^)]*\)|https?://[^\s)]+|^[ \t]*#{1,3} |^[ \t]*(?:\d+\. |[-*+] )|\*\*|(?<![A-Za-z])[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?%?", re.M)


def protected_lines(source):
    tokens = []
    def protect(match):
        value = match.group(0)
        # Translate link/figure captions while keeping the target byte-for-byte.
        if re.match(r"!?\[", value):
            prefix = "!" if value.startswith("!") else ""
            label, target = re.match(r"!?\[([^\]]*)\]\(([^)]*)\)", value).groups()
            tokens.append(prefix+'[')
            first=f"__BS_KEEP_{len(tokens)-1:04}__"
            label=PROTECT.sub(protect,label)
            tokens.append(f"]({target})")
            return first+label+f"__BS_KEEP_{len(tokens)-1:04}__"
        tokens.append(value)
        return f"__BS_KEEP_{len(tokens)-1:04}__"
    masked = PROTECT.sub(protect, source)
    return masked.splitlines(), tokens


def translate():
    model = os.environ.get("BS_TRANSLATE_MODEL", "qwen3.8:27b")
    host = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
    cache_path = CONTENT / "translation-cache.json"
    cache = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    for stem, *_ in LESSONS:
        source = (CONTENT / f"{stem}.zh.md").read_text(encoding="utf-8")
        lines, tokens = protected_lines(source)
        needed = [(i, line) for i, line in enumerate(lines) if re.search(r"[\u4e00-\u9fff]", line)]
        for start in range(0, len(needed), 10):
            group = needed[start:start+10]
            todo = [(i,line) for i,line in group if digest(line.encode()) not in cache]
            if not todo:
                continue
            payload = [line for _,line in todo]
            prompt = ("Translate each string in this JSON array from Simplified Chinese into clear English for a mathematical finance course. "
                      "Return only a JSON object with key translations containing the same number of strings in the same order. "
                      "Translate ALL human prose, including captions and headings. Preserve every __BS_KEEP_NNNN__ placeholder exactly once, "
                      "with the same order and spelling. Preserve Markdown pipes, brackets and line structure. Do not introduce new formulas, "
                      "Do not interpret placeholders as formatting: copy BOTH placeholder markers around every bold heading. "
                      "numbers, explanatory paragraphs or quotation marks around headings. Use: paper pause, answer, probability measure, "
                      "physical measure, risk-neutral measure, continuous dividend yield, truncation error, roundoff error, spot. "
                      "Do not summarize. Call, Put, Delta, Gamma, Vega, Theta, Rho, Hermite, CDF, PDE and API keep their conventional names.\n"
                      +json.dumps(payload, ensure_ascii=False))
            error = None
            for attempt in range(2):
                try:
                    data = dict(model=model, prompt=prompt, stream=False, think=False, format="json", keep_alive="15m",
                                options=dict(temperature=0, num_ctx=16384, num_predict=5000))
                    request = urllib.request.Request(host+"/api/generate", json.dumps(data).encode(), {"Content-Type":"application/json"})
                    with urllib.request.urlopen(request, timeout=600) as response:
                        result = json.load(response)
                    translated = json.loads(result["response"])["translations"]
                    if len(translated) != len(payload):
                        raise ValueError("Translation line count changed")
                    for original, english in zip(payload, translated):
                        before = re.findall(r"__BS_KEEP_\d+__", original)
                        after = re.findall(r"__BS_KEEP_\d+__", english)
                        # Inline placeholders may move with English grammar; each
                        # must remain present exactly once and is restored by ID.
                        if sorted(before) != sorted(after) or re.search(r"[\u4e00-\u9fff]", english) or "\n" in english:
                            write(CONTENT/'translation-failure.json',json.dumps(dict(original=original,english=english,before=before,after=after),ensure_ascii=False,indent=2))
                            raise ValueError("Protected tokens or prose line structure changed")
                        if original.count("|") != english.count("|") or original.count("[") != english.count("["):
                            write(CONTENT/'translation-failure.json',json.dumps(dict(original=original,english=english),ensure_ascii=False,indent=2))
                            raise ValueError("Table or link structure changed")
                    for original,english in zip(payload,translated):
                        cache[digest(original.encode())] = english
                    write(cache_path,json.dumps(cache,ensure_ascii=False,indent=2)+"\n")
                    print(f"{stem}: translated prose lines {min(start+10,len(needed))}/{len(needed)}", flush=True)
                    error = None
                    break
                except (ValueError, KeyError, OSError) as exc:
                    error = exc
                    print(f"Translation retry {attempt+1}: {exc}", flush=True)
            if error:
                raise RuntimeError(f"Could not translate {stem}: {error}")
        for i,line in needed:
            lines[i] = cache[digest(line.encode())]
        english = "\n".join(lines)+"\n"
        english = re.sub(r"__BS_KEEP_(\d+)__",lambda m:tokens[int(m.group(1))],english)
        english = re.sub(r"\*\*([^\n]*?)\*\*",lambda m:'**'+m.group(1).strip()+'**',english)
        english = re.sub(r"(\*\*[^\n]*?\*\*)(?=[A-Za-z0-9])",r"\1 ",english)
        write(CONTENT / f"{stem}.en.md", english)
        write(CONTENT / f"{stem}.translation.json", json.dumps(dict(model=model,sourceSha256=digest(source.encode()),englishSha256=digest(english.encode())),indent=2)+"\n")
        print(f"{stem}: English snapshot complete",flush=True)


def table(rows):
    cells=[]
    for row in rows:
        math=[]
        masked=re.sub(r"\$[^\n$]+\$", lambda m: (math.append(m.group()) or f"@@M{len(math)-1}@@"),row)
        parts=masked.strip().strip("|").split("|")
        cells.append([re.sub(r"@@M(\d+)@@",lambda m:math[int(m.group(1))],part.strip()) for part in parts])
    result=['<div class="bs-paper-table-scroll">','<table class="bs-paper-table">','<thead>','<tr>']
    for cell in cells[0]:
        result += ['<th>', '', cell, '', '</th>']
    result += ['</tr>','</thead>','<tbody>']
    for row in cells[2:]:
        result.append('<tr>')
        for cell in row:
            result += ['<td>','',cell,'','</td>']
        result.append('</tr>')
    return '\n'.join(result+['</tbody>','</table>','</div>'])


def to_mdx(source, language, number):
    # Full prose and all mathematical bytes survive; only reader affordances change.
    body=re.sub(r"^# [^\n]*\n+", "", source, count=1)
    imports=['import { BSMaterials, bsMaterialHref } from "../../../framework/quant/BSPaperCourse";']
    if '<RadonNikodymLab />' in body:
        imports.append('import { RadonNikodymLab } from "../../../framework/quant/RadonNikodymLab";')
    images=list(re.finditer(r"!\[([^\]]*)\]\([^)]*/([^/)]+\.png)\)",body))
    for i,m in reversed(list(enumerate(images))):
        alt,name=m.groups()
        imports.append(f'import bsFigure{i} from "../../../content/bs-math/assets/{name}";')
        figure=f'<Figure id="bs-{number:02}-figure-{i}">\n\n<img class="bs-paper-image" src={{bsFigure{i}}} alt={json.dumps(alt,ensure_ascii=False)} />\n\n<figcaption>{alt}</figcaption>\n\n</Figure>'
        body=body[:m.start()]+figure+body[m.end():]
    # Relative report links become downloadable local references, not broken URLs.
    body=re.sub(r"\[([^\]]+)\]\((?!https?:)([^)]+\.md)\)",lambda m:f'<a href={{bsMaterialHref({json.dumps(Path(m.group(2)).name)})}}>{m.group(1)}</a>',body)
    lines=body.splitlines(); output=[]; i=0; answer=False; fenced=False
    while i<len(lines):
        line=lines[i]
        if line.startswith('```'):
            fenced=not fenced
        if not fenced and re.match(r'^#{1,3} ',line):
            if answer:
                output += ['', '</details>', '']; answer=False
            if line.startswith('### ') and re.search(r'答案|\banswer\b|\bsolution\b',line,re.I):
                output += ['<details class="bs-paper-answer">',f'<summary>{line[4:]}</summary>','']
                answer=True; i+=1; continue
        if not fenced and line.lstrip().startswith('|'):
            rows=[]
            while i<len(lines) and lines[i].lstrip().startswith('|'):
                rows.append(lines[i]); i+=1
            output.append(table(rows)); continue
        if not fenced:
            # A closing bold delimiter after Chinese punctuation needs a space
            # before the following word to satisfy CommonMark delimiter rules.
            line=re.sub(r'(\*\*[^\n]*?\*\*)(?=\w)',r'\1 ',line)
        output.append(line); i+=1
    if answer:
        output += ['', '</details>']
    body='\n'.join(output)
    return '\n'.join(imports)+f'\n\n<div class="bs-paper-content">\n\n{body}\n\n</div>\n\n<BSMaterials lang="{language}" lesson={{{number}}} />\n'


def write_lesson(slug, meta, bodies):
    target=ROOT/'subjects'/'quant'/slug
    write(target/'meta.json',json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
    for language,body in bodies.items():
        write(target/f'lesson.{language}.mdx',body)
    main=(ROOT/'subjects/quant/15-black-scholes-pricing/main.tsx').read_text(encoding='utf-8')
    main=main.replace("import '../../../framework/theme/index.css';", "import '../../../framework/theme/index.css';\nimport '../../../framework/quant/bs-paper.css';")
    write(target/'main.tsx',main)
    title=html.escape(meta['title']['en'])
    write(target/'index.html',f'<!doctype html>\n<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>{title}</title></head>\n<body><div id="app"></div><script type="module" src="./main.tsx"></script></body></html>\n')


def navigation_link(number):
    if number==0:
        slug='18-bs-paper-course'; title=dict(en='BS and Greeks: paper course',zh='BS 与 Greeks：纸笔推导课程')
    else:
        _,slug,en,zh,*_=LESSONS[number-1]; title=dict(en=en,zh=zh)
    return dict(id=f'QUANT-BS{number}',title=title,devHref=f'/subjects/quant/{slug}/index.html',buildHref=f'/quant-{slug}.html')


def adapt():
    PUBLIC.mkdir(parents=True,exist_ok=True)
    for item in CONTENT.glob('*.md'):
        shutil.copy2(item,PUBLIC/item.name)
        if item.name.endswith('.zh.md'):
            shutil.copy2(item,PUBLIC/item.name.replace('.zh.md','.md'))
    for item in (CONTENT/'assets').iterdir():
        if item.is_dir():
            shutil.copytree(item,PUBLIC/item.name,dirs_exist_ok=True)
        else:
            shutil.copy2(item,PUBLIC/item.name)
    for number,(stem,slug,en,zh,module,hours) in enumerate(LESSONS,1):
        source=(CONTENT/f'{stem}.zh.md').read_text(encoding='utf-8')
        translated=(CONTENT/f'{stem}.en.md').read_text(encoding='utf-8')
        proof=json.loads((CONTENT/f'{stem}.translation.json').read_text(encoding='utf-8'))
        if proof['sourceSha256']!=digest(source.encode()) or proof['englishSha256']!=digest(translated.encode()):
            raise ValueError(f'{stem}: translation snapshot is stale; refresh and review before regenerating')
        verify_math_and_code(source, translated, stem)
        meta=dict(id=f'QUANT-BS{number}',subject='quant',module=f'BS paper · {module} ({number:02}/08)',title=dict(en=en,zh=zh),
                  prereqs=['QUANT-P2'] if number==1 else [f'QUANT-BS{number-1}'],estimatedHours=hours,
                  spine=dict(en=dict(a='Rebuild the derivation with paper and pencil.',b='Compare assumptions, formulas and the supplied numerical evidence.'),
                             zh=dict(a='用纸笔重建每步推导，先尝试再打开答案。',b='对照假设、公式、图片与提供的数值证据。')),
                  assignment=f'Paper pauses · chapter {number:02}',references=['Quant_interview BS assignment (5 pages)','Original corrected paper-workbook derivations'],
                  navigation=dict(previous=navigation_link(number-1),indexHref=dict(dev='/subjects/quant/18-bs-paper-course/index.html',build='/quant-18-bs-paper-course.html')))
        if number<8:
            meta['navigation']['next']=navigation_link(number+1)
        bodies={language:to_mdx(text,language,number) for language,text in [('en',translated),('zh',source)]}
        write_lesson(slug,meta,bodies)
    hub=ROOT/'content/bs-math/hub'
    meta=dict(id='QUANT-BS0',subject='quant',module='BS paper · course map',title=dict(en='BS and Greeks: paper course',zh='BS 与 Greeks：纸笔推导课程'),
              prereqs=['QUANT-P1','QUANT-P2'],estimatedHours=12,
              navigation=dict(next=navigation_link(1)),references=['NIST DLMF','Utah financial mathematics notes','Lean Language Reference'])
    write_lesson('18-bs-paper-course',meta,{language:(hub/f'lesson.{language}.mdx').read_text(encoding='utf-8') for language in ['en','zh']})
    print('Adapted eight full EN/ZH lessons and their course hub. Formulas and datasets are preserved.',flush=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--import-source',action='store_true')
    parser.add_argument('--translate',action='store_true')
    args=parser.parse_args()
    if args.import_source:
        import_sources()
    if args.translate:
        translate()
    adapt()


if __name__=='__main__':
    main()
