"""Inventory the local MIT 18.02SC package, build the 69-game manifest and extract authoring evidence.

Run from the tutoring repository: python -X utf8 scripts/prepare-mit-multivariable-calculus.py
No network requests or PDF modifications. Windows long paths (> 260 characters) are read with the \\\\?\\ prefix,
because several session directories exceed the limit and are invisible to plain glob/open.
"""
import html
import json
import os
import pathlib
import re
from pypdf import PdfReader

ROOT = pathlib.Path(__file__).resolve().parents[1]
SLUG = '18-02sc-multivariable-calculus-fall-2010'
PACKAGE = ROOT.parent / 'Open_Courses' / SLUG / 'package'
OUT = ROOT / 'framework/games/mit-multivariable-calculus'
EVIDENCE = ROOT / 'content/mit-multivariable-calculus/sources'
BS = chr(92)

# (id number, unit, kind, session label, sessions or exam key, English title, Chinese title)
# Unit 5 is the final review and final exam.  Exam keys: ('exam', n) or ('final',).
GAMES = [
    (1, 1, 'topic', '1', [1], 'Vectors', '向量'),
    (2, 1, 'topic', '2–3', [2, 3], 'Dot Products, Lengths and Angles', '点积、长度与夹角'),
    (3, 1, 'topic', '4', [4], 'Vector Components and Projection', '向量分量与投影'),
    (4, 1, 'topic', '5–6', [5, 6], 'Determinants: Area and Volume', '行列式：面积与体积'),
    (5, 1, 'topic', '7', [7], 'Cross Products', '叉积'),
    (6, 1, 'topic', '8', [8], 'Equations of Planes', '平面方程'),
    (7, 1, 'topic', '9–10', [9, 10], 'Matrix Multiplication', '矩阵乘法'),
    (8, 1, 'topic', '11', [11], 'Matrix Inverses', '逆矩阵'),
    (9, 1, 'topic', '12–13', [12, 13], 'Planes and Linear Systems', '平面与线性方程组'),
    (10, 1, 'topic', '14', [14], 'Solutions to Square Systems', '方阵方程组的解'),
    (11, 1, 'topic', '15–16', [15, 16], 'Lines, and a Line Meeting a Plane', '直线，以及直线与平面的交点'),
    (12, 1, 'topic', '17–18', [17, 18], 'Parametric Curves: the Cycloid and its Cusp', '参数曲线：摆线与尖点'),
    (13, 1, 'topic', '19–20', [19, 20], 'Velocity, Acceleration and Arc Length', '速度、加速度与弧长'),
    (14, 1, 'topic', '21', [21], "Kepler's Second Law", '开普勒第二定律'),
    (15, 1, 'review', '22–23', [22, 23], 'Unit 1 Review', '第一单元复习'),
    (16, 1, 'exam', '1', ('exam', 1), 'Exam 1', '第一次考试挑战'),
    (17, 2, 'topic', '24–25', [24, 25], 'Functions of Two Variables and Level Curves', '二元函数与等高线'),
    (18, 2, 'topic', '26', [26], 'Partial Derivatives', '偏导数'),
    (19, 2, 'topic', '27', [27], 'Tangent Plane Approximation', '切平面与近似公式'),
    (20, 2, 'topic', '28', [28], 'Optimization', '最优化'),
    (21, 2, 'topic', '29', [29], 'Least Squares', '最小二乘'),
    (22, 2, 'topic', '30–31', [30, 31], 'The Second Derivative Test', '二阶导数判别法'),
    (23, 2, 'topic', '32–33', [32, 33], 'Total Differentials and the Chain Rule', '全微分与链式法则'),
    (24, 2, 'topic', '34', [34], 'The Chain Rule with More Variables', '多变量链式法则'),
    (25, 2, 'topic', '35–37', [35, 36, 37], 'The Gradient and Level Curves', '梯度与等高线'),
    (26, 2, 'topic', '38', [38], 'Directional Derivatives', '方向导数'),
    (27, 2, 'topic', '39–40', [39, 40], 'Lagrange Multipliers: Statement and Proof', 'Lagrange 乘数法：命题与证明'),
    (28, 2, 'topic', '41', [41], 'Lagrange Multipliers: An Advanced Example', 'Lagrange 乘数法：进阶例子'),
    (29, 2, 'topic', '42–44', [42, 43, 44], 'Constrained Differentials', '约束微分'),
    (30, 2, 'review', '45–46', [45, 46], 'Unit 2 Review', '第二单元复习'),
    (31, 2, 'exam', '2', ('exam', 2), 'Exam 2', '第二次考试挑战'),
    (32, 3, 'topic', '47', [47], 'Definition of Double Integrals', '二重积分的定义'),
    (33, 3, 'topic', '48', [48], 'Examples of Double Integration', '二重积分的例子'),
    (34, 3, 'topic', '49', [49], 'Exchanging the Order of Integration', '交换积分次序'),
    (35, 3, 'topic', '50', [50], 'Double Integrals in Polar Coordinates', '极坐标二重积分'),
    (36, 3, 'topic', '51–52', [51, 52], 'Mass, Average Value and Moment of Inertia', '质量、平均值与转动惯量'),
    (37, 3, 'topic', '53–55', [53, 54, 55], 'Change of Variables and the Jacobian', '换元与 Jacobian'),
    (38, 3, 'topic', '56', [56], 'Vector Fields', '向量场'),
    (39, 3, 'topic', '57–59', [57, 58, 59], 'Work and Line Integrals', '功与线积分'),
    (40, 3, 'topic', '60', [60], 'The Fundamental Theorem for Line Integrals', '线积分基本定理'),
    (41, 3, 'topic', '61–63', [61, 62, 63], 'Conservative Fields and Potential Functions', '保守场与势函数'),
    (42, 3, 'topic', '64', [64], 'Curl', '旋度'),
    (43, 3, 'topic', '65', [65], "Green's Theorem", 'Green 定理'),
    (44, 3, 'topic', '66, 72', [66, 72], 'Curl F = 0 and Simply Connected Regions', 'curl F = 0 与单连通区域'),
    (45, 3, 'topic', '67–68', [67, 68], "Proof of Green's Theorem; the Planimeter", 'Green 定理的证明与测面积仪'),
    (46, 3, 'topic', '69–70', [69, 70], 'Flux in 2D and the Normal Form', '二维通量与法向形式'),
    (47, 3, 'topic', '71', [71], "Extended Green's Theorem", '扩展的 Green 定理'),
    (48, 3, 'review', '73', [73], 'Unit 3 Review', '第三单元复习'),
    (49, 3, 'exam', '3', ('exam', 3), 'Exam 3', '第三次考试挑战'),
    (50, 4, 'topic', '74', [74], 'Triple Integrals: Rectangular and Cylindrical Coordinates', '三重积分：直角与柱坐标'),
    (51, 4, 'topic', '75', [75], 'Triple Integrals: Applications and Examples', '三重积分的应用与例子'),
    (52, 4, 'topic', '76–77', [76, 77], 'Spherical Coordinates', '球坐标'),
    (53, 4, 'topic', '78', [78], 'Gravitational Attraction', '引力'),
    (54, 4, 'topic', '79–80', [79, 80], 'Vector Fields in Space and Flux', '空间向量场与通量'),
    (55, 4, 'topic', '81–83', [81, 82, 83], 'Calculating Flux: Finding ndS', '求通量：ndS'),
    (56, 4, 'topic', '84–85', [84, 85], 'The Divergence Theorem', '散度定理'),
    (57, 4, 'topic', '86–87', [86, 87], 'Proof of the Divergence Theorem; the Diffusion Equation', '散度定理的证明与扩散方程'),
    (58, 4, 'topic', '88–89', [88, 89], 'Line Integrals in Space and Potential Functions', '空间线积分与势函数'),
    (59, 4, 'topic', '90', [90], 'Curl in 3D', '空间中的旋度'),
    (60, 4, 'topic', '91–93', [91, 92, 93], "Stokes' Theorem", 'Stokes 定理'),
    (61, 4, 'topic', '94–95', [94, 95], 'Simply Connected Regions and Surface Independence', '单连通区域与曲面无关性'),
    (62, 4, 'topic', '96', [96], 'Summary of Multiple Integration', '多重积分总结'),
    (63, 4, 'topic', '97–98', [97, 98], "Curl and Physics; Maxwell's Equations", '旋度与物理；Maxwell 方程'),
    (64, 4, 'exam', '4', ('exam', 4), 'Exam 4', '第四次考试挑战'),
    (65, 5, 'review', '99', [99], 'Final Review: Unit 1', '期末复习：第一单元'),
    (66, 5, 'review', '100', [100], 'Final Review: Unit 2', '期末复习：第二单元'),
    (67, 5, 'review', '101', [101], 'Final Review: Unit 3', '期末复习：第三单元'),
    (68, 5, 'review', '102', [102], 'Final Review: Unit 4', '期末复习：第四单元'),
    (69, 5, 'exam', 'Final', ('final',), 'Final Exam', '期末考试挑战'),
]


def lp(path):
    """Long-path-safe string for Windows."""
    return BS * 2 + '?' + BS + os.path.abspath(path) if os.name == 'nt' else str(path)


def read_json(path):
    with open(lp(path), encoding='utf-8') as handle:
        return json.load(handle)


def plain(value):
    return html.unescape(re.sub(r'<[^>]+>', ' ', value)).strip()


def compact(text):
    """Drop control characters and collapse whitespace so authors read far fewer tokens."""
    text = re.sub(r'[\x00-\x08\x0b-\x1f]', '', text or '')
    text = re.sub(r'[ \t]+', ' ', text)
    return re.sub(r'\n\s*(?:\n\s*)+', '\n', text).strip()


def classify(filename):
    name = re.sub(r'^[0-9a-f]{32}_', '', filename)
    if re.search(r'_we_', name): return 'examples'
    if re.search(r'_pb_\d+_quest', name): return 'problems'
    if re.search(r'_pb_\d+_comb', name): return 'solutions'
    if re.search(r'(_notes_|_MNotes_)', name): return 'notes'
    if re.search(r'Rec_\d+', name): return 'recitation'
    if re.search(r'(exam\d?sol|finalexamsol)\.pdf$', name): return 'solutions'
    if re.search(r'prac.*sol\.pdf$', name): return 'practiceSolutions'
    if re.search(r'prac', name): return 'practice'
    if re.search(r'(exam\d?|finalexam)\.pdf$', name): return 'problems'
    if re.search(r'pset\d+sol', name): return 'solutions'
    if re.search(r'pset\d+', name): return 'problems'
    return 'transcript'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    resources = {}
    for entry in os.listdir(lp(PACKAGE / 'resources')):
        data = PACKAGE / 'resources' / entry / 'data.json'
        if os.path.exists(lp(data)):
            resources[entry] = read_json(data)
    catalog = json.loads((ROOT / 'public/open-courses/catalog.json').read_text(encoding='utf-8'))
    course = next(c for c in catalog['courses'] if c['slug'] == SLUG)
    available = {r['filename']: r['url'] for r in course['resources']}

    # session number -> page directory (long-path safe), plus exam page directories.
    session_dir, page_dirs = {}, {}
    for dirpath, _dirs, files in os.walk(lp(PACKAGE / 'pages')):
        if 'data.json' not in files:
            continue
        clean = dirpath[4:] if dirpath.startswith(BS * 2 + '?' + BS) else dirpath
        page_dirs[pathlib.PurePath(clean).relative_to(PACKAGE / 'pages').as_posix()] = pathlib.Path(clean)
        match = re.match(r'session-(\d+)-', os.path.basename(clean))
        if match:
            session_dir[int(match.group(1))] = pathlib.Path(clean)
    assert sorted(session_dir) == list(range(1, 103)), sorted(set(range(1, 103)) - set(session_dir))

    def docs_of(page_path, only=None):
        data = read_json(page_path / 'data.json')
        found = []
        for key in dict.fromkeys(re.findall(r'resources/([^/]+)/index.html', data['content'])):
            r = resources.get(key)
            file = (r or {}).get('file') or ''
            if not file.endswith('.pdf'):
                continue
            filename = pathlib.PurePosixPath(file).name
            asset = available.get(filename)
            if asset is None:
                matches = [v for k, v in available.items() if k.split('_', 1)[-1] == filename.split('_', 1)[-1]]
                if not matches:
                    raise ValueError(f'Missing local asset: {filename}')
                asset = matches[0]
            kind = classify(filename)
            if only and kind not in only:
                continue
            found.append({'kind': kind, 'title': r['title'], 'asset': asset, 'filename': filename})
        return data, found

    def exam_pages(key):
        if key[0] == 'final':
            return [page_dirs['final-exam-1/final-exam'], page_dirs['final-exam-1/practice-final-exam']]
        unit = key[1]
        out = []
        for rel, path in sorted(page_dirs.items()):
            parts = rel.split('/')
            if len(parts) == 3 and parts[1] == f'exam-{unit}' and parts[2] in ('exam', 'exam-materials', 'practice-exam'):
                out.append(path)
        assert out, key
        return out

    def practice_for(unit):
        return exam_pages(('final',) if unit == 5 else ('exam', unit))[-1] if unit != 5 else page_dirs['final-exam-1/practice-final-exam']

    games, thin = [], []
    for number, unit, kind, session, spec, en, zh in GAMES:
        game_id = f'MIT-MV-{number:02}'
        if isinstance(spec, tuple):
            pages = exam_pages(spec)
            overview_pages = pages
        else:
            pages = [session_dir[s] for s in spec]
            overview_pages = pages
        docs, overviews, has_notes, has_problems = [], [], False, False
        for page in pages:
            data, found = docs_of(page)
            overviews.append((data['title'], plain(data['content'])))
            for d in found:
                if not any(v['asset'] == d['asset'] for v in docs):
                    docs.append(d)
            has_notes |= any(d['kind'] == 'notes' for d in found)
            has_problems |= any(d['kind'] == 'problems' for d in found)
        if kind == 'review' and not [d for d in docs if d['kind'] not in ('transcript', 'recitation')]:
            # Review sessions publish only videos; the unit's practice exam is the closest honest source.
            _, found = docs_of(practice_for(unit))
            for d in found:
                if not any(v['asset'] == d['asset'] for v in docs):
                    docs.append(d)
        evidence = 'exam' if kind == 'exam' else 'thin' if not (has_notes or has_problems) else 'full'
        if evidence == 'thin':
            thin.append(game_id)
        slug = pathlib.Path(pages[0]).name
        first = pathlib.Path(pages[0])
        official = f'https://ocw.mit.edu/courses/{SLUG}/pages/{first.relative_to(PACKAGE / "pages").as_posix()}/'
        sessions = list(spec) if isinstance(spec, list) else []
        game = {'id': game_id, 'sequence': number, 'unit': unit, 'session': session, 'sessions': sessions,
                'slug': slug, 'kind': kind, 'evidence': evidence, 'title': {'en': en, 'zh': zh},
                'officialUrl': official, 'sources': docs}
        games.append(game)
        parts = [f'{game_id} | {en} | evidence: {evidence}\nOfficial: {official}']
        for title, text in overviews:
            parts.append(f'\nSESSION OVERVIEW: {title}\n{text}')
        for doc in docs:
            if doc['kind'] in ('transcript', 'recitation') and any(d['kind'] not in ('transcript', 'recitation') for d in docs):
                continue
            source = ROOT / 'public/open-courses' / doc['asset']
            assert source.is_file(), source
            reader = PdfReader(source)
            text = '\n'.join(f'\n--- PDF page {j + 1} ---\n{compact(page.extract_text())}' for j, page in enumerate(reader.pages))
            parts.append(f"\n\n=== {doc['kind'].upper()}: {doc['filename']} ===\n{text}")
        (EVIDENCE / f'{number:02}-{slug}.txt').write_text('\n'.join(parts), encoding='utf-8')

    part_resources = []
    for rel, path in sorted(page_dirs.items()):
        if re.search(r'/problem-set-\d+$', rel):
            data, found = docs_of(path)
            number = int(re.search(r'problem-set-(\d+)$', rel).group(1))
            unit = int(rel[0])
            part_resources.append({'problemSet': number, 'unit': unit, 'title': data['title'],
                                   'officialUrl': f'https://ocw.mit.edu/courses/{SLUG}/pages/{rel}/',
                                   'sources': [d for d in found if d['kind'] in ('problems', 'solutions')]})
    part_resources.sort(key=lambda p: p['problemSet'])

    manifest = {'course': SLUG, 'officialUrl': f'https://ocw.mit.edu/courses/{SLUG}/', 'license': 'CC BY-NC-SA 4.0',
                'version': 1, 'games': games, 'problemSets': part_resources}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    report = ['# MIT 18.02SC game inventory', '',
              f'{len(games)} planned games covering 102 numbered sessions and 5 exams; {len(part_resources)} problem sets are listed in the manifest.',
              'Evidence `thin` means none of the covered sessions publishes lecture notes or problems; authors must not invent material.', '',
              '| Game | Sessions | Evidence | Topic | Source files |', '|---|---|---|---|---|']
    for g in games:
        links = ', '.join(f"[{s['kind']}](../public/open-courses/{s['asset']})" for s in g['sources'] if s['kind'] not in ('transcript', 'recitation'))
        report.append(f"| {g['id']} | {g['session']} | {g['evidence']} | {g['title']['zh']} / {g['title']['en']} | {links} |")
    (ROOT / 'docs/mit-multivariable-calculus-games.md').write_text('\n'.join(report) + '\n', encoding='utf-8')
    print(f'Inventory: {len(games)} games; {sum(len(g["sources"]) for g in games)} source links; {len(part_resources)} problem sets')
    print('Thin evidence:', ', '.join(thin))


if __name__ == '__main__':
    main()
