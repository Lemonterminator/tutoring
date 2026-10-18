"""Inventory the local MIT 18.06SC package and extract authoring evidence.

Run from the tutoring repository. No network requests or PDF modifications.
"""
import html
import json
import pathlib
import re
from pypdf import PdfReader

ROOT = pathlib.Path(__file__).resolve().parents[1]
SLUG = '18-06sc-linear-algebra-fall-2011'
PACKAGE = ROOT.parent / 'Open_Courses' / SLUG / 'package'
OUT = ROOT / 'framework/games/mit-linear-algebra'
EVIDENCE = ROOT / 'content/mit-linear-algebra/sources'

ZH = [
    '线性方程的几何', '用矩阵消元', '矩阵乘法与逆矩阵', '分解 A = LU',
    '转置、置换与向量空间', '列空间与零空间', '解 Ax = 0：主元变量与特殊解',
    '解 Ax = b：行最简形', '独立性、基与维数', '四个基本子空间',
    '矩阵空间、秩一与小世界图', '图、网络与关联矩阵', '关键思想概览', '第一次考试复习', '第一次考试挑战',
    '正交向量与子空间', '投影到子空间', '投影矩阵与最小二乘', '正交矩阵与 Gram–Schmidt',
    '行列式的性质', '行列式公式与代数余子式', 'Cramer 法则、逆矩阵与体积',
    '特征值与特征向量', '对角化与矩阵幂', '微分方程与 exp(At)', 'Markov 矩阵与 Fourier 级数',
    '第二次考试复习', '第二次考试挑战', '对称矩阵与正定性', '复矩阵与快速 Fourier 变换',
    '正定矩阵与极小值', '相似矩阵与 Jordan 形', '奇异值分解', '线性变换及其矩阵',
    '换基与图像压缩', '左逆、右逆与伪逆', '第三次考试复习', '第三次考试挑战',
    '全课程复习', '期末考试挑战', '2023 告别讲座：线性代数应用回顾',
]


def plain(value):
    return html.unescape(re.sub(r'<[^>]+>', ' ', value)).strip()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    resources = {p.parent.name: json.loads(p.read_text(encoding='utf-8'))
                 for p in (PACKAGE / 'resources').glob('*/data.json')}
    catalog = json.loads((ROOT / 'public/open-courses/catalog.json').read_text(encoding='utf-8'))
    course = next(c for c in catalog['courses'] if c['slug'] == SLUG)
    available = {r['filename']: r['url'] for r in course['resources']}
    pages = []
    for group in ['ax-b-and-the-four-subspaces', 'least-squares-determinants-and-eigenvalues',
                  'positive-definite-matrices-and-applications']:
        for path in (PACKAGE / 'pages' / group).glob('*/data.json'):
            d = json.loads(path.read_text(encoding='utf-8'))
            resource_ids = list(dict.fromkeys(re.findall(r'resources/([^/]+)/index.html', d['content'])))
            summary = next((resources[k].get('file') for k in resource_ids
                            if re.search(r'Ses\d+\.\d+sum\.pdf$', resources[k].get('file') or '')), None)
            if summary:
                unit, session = map(int, re.search(r'Ses(\d+)\.(\d+)sum', summary).groups())
                pages.append((unit, session, path, resource_ids))
            elif path.parent.name.startswith('exam-'):
                unit = ['ax-b-and-the-four-subspaces', 'least-squares-determinants-and-eigenvalues',
                        'positive-definite-matrices-and-applications'].index(group) + 1
                pages.append((unit, 99, path, resource_ids))
    pages.sort(key=lambda p: p[:2])
    for session, slug in enumerate(['final-course-review', 'final-exam', 'final-1806-lecture-2023'], 1):
        path = PACKAGE / 'pages' / slug / 'data.json'
        d = json.loads(path.read_text(encoding='utf-8'))
        pages.append((4, session, path, list(dict.fromkeys(re.findall(r'resources/([^/]+)/index.html', d['content'])))))
    assert len(pages) == len(ZH) == 41, len(pages)
    games = []
    for i, (unit, session, path, resource_ids) in enumerate(pages, 1):
        d = json.loads(path.read_text(encoding='utf-8'))
        slug = path.parent.name
        kind = 'bonus' if unit == 4 and session == 3 else 'review' if 'review' in slug else 'exam' if 'exam' in slug else 'topic'
        docs = []
        for key in resource_ids:
            r = resources[key]
            file = r.get('file') or ''
            if not file.endswith('.pdf'):
                continue
            filename = pathlib.PurePosixPath(file).name
            if filename not in available:
                # Content-deduplicated public assets can have another hash prefix.
                candidates = [v for k, v in available.items() if k.split('_', 1)[-1] == filename.split('_', 1)[-1]]
                if not candidates:
                    raise ValueError(f'Missing local asset: {filename}')
                asset = candidates[0]
            else:
                asset = available[filename]
            category = 'notes' if 'sum.pdf' in filename.lower() else 'solutions' if re.search(r'(?:sol|ex[123]s|final_exs)\.pdf$', filename, re.I) else 'problems' if re.search(r'(?:prob|ex[123]|final_ex)\.pdf$', filename, re.I) else 'transcript'
            if not any(v['asset'] == asset for v in docs):
                docs.append({'kind': category, 'title': r['title'], 'asset': asset, 'filename': filename})
        if kind == 'bonus':
            direct = re.findall(r'([^"/]+\.pdf)', d['content'])
            for filename in direct:
                if filename in available:
                    docs.append({'kind': 'transcript', 'title': 'Final 18.06 Lecture 2023 transcript', 'asset': available[filename], 'filename': filename})
        assert docs, slug
        relative = path.parent.relative_to(PACKAGE).as_posix()
        game = {'id': f'MIT-LA-{i:02}', 'sequence': i, 'unit': unit, 'session': f'{unit}.{session}' if session != 99 else f'Exam {unit}',
                'slug': slug, 'kind': kind, 'title': {'en': d['title'], 'zh': ZH[i-1]},
                'officialUrl': f'https://ocw.mit.edu/courses/{SLUG}/{relative}/', 'sources': docs}
        games.append(game)
        texts = [f"{game['id']} | {d['title']}\nOfficial: {game['officialUrl']}\n\nSESSION OVERVIEW\n{plain(d['content'])}"]
        chosen = [doc for doc in docs if doc['kind'] != 'transcript'] or docs[:1]
        for doc in chosen:
            source = ROOT / 'public/open-courses' / doc['asset']
            assert source.is_file(), source
            reader = PdfReader(source)
            text = '\n'.join(f'\n--- PDF page {j+1} ---\n{page.extract_text(extraction_mode="layout")}' for j, page in enumerate(reader.pages))
            texts.append(f"\n\n=== {doc['kind'].upper()}: {doc['filename']} ===\n{text}")
        (EVIDENCE / f'{i:02}-{slug}.txt').write_text('\n'.join(texts), encoding='utf-8')
    manifest = {'course': SLUG, 'officialUrl': f'https://ocw.mit.edu/courses/{SLUG}/',
                'license': 'CC BY-NC-SA 4.0', 'version': 1, 'games': games}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    concept_map = {}
    for topic in course['topics']:
        assets = {s['resourceUrl'].split('#')[0] for s in topic.get('sources', [topic])}
        matching = [g['id'] for g in games if any(s['asset'] in assets for s in g['sources'])]
        if matching:
            concept_map[topic['nodeId']] = matching
    (OUT / 'concept-map.json').write_text(json.dumps(concept_map, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    report = ['# MIT 18.06SC complete game coverage', '',
              '40 main-course games (32 topics, 4 reviews, 4 exams) plus the 2023 supplemental lecture = 41 games.', '',
              'Each game adapts the source topics into bounded practice; it does not claim to reproduce every original exam question.', '',
              '| Game | Session | Topic | Source files |', '|---|---|---|---|']
    for g in games:
        links = ', '.join(f"[{s['kind']}](../public/open-courses/{s['asset']})" for s in g['sources'] if s['kind'] != 'transcript' or g['kind'] == 'bonus')
        report.append(f"| {g['id']} | {g['session']} | {g['title']['zh']} / {g['title']['en']} | {links} |")
    (ROOT / 'docs/mit-linear-algebra-games.md').write_text('\n'.join(report) + '\n', encoding='utf-8')
    print(f"Inventory: {len(games)} games; {sum(len(g['sources']) for g in games)} source links")
    for g in games:
        print(g['id'], g['session'], g['kind'], g['title']['en'])


if __name__ == '__main__':
    main()
