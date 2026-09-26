# src/page.html に src/core.js と model/model.json を埋め込み、1ファイルの index.html を作る。
# 使い方: python3 scripts/build.py
import json, os
root = os.path.join(os.path.dirname(__file__), '..')
rd = lambda p: open(os.path.join(root, p), encoding='utf-8').read()
results = {
    "teacherMs": 7.2, "teacherStop": [35, 40], "teacherRT": [0, 20], "student": [91, 120],
    "note": "事前計測（Node.js）。テストは学習に使っていない開始待機。教師は計算時間の都合で40通り・20通りに間引いています。判断1回の時間は中央値。",
}
model = json.loads(rd('model/model.json'))
html = (rd('src/page.html')
        .replace('/*CORE*/', rd('src/core.js'))
        .replace('/*MODEL*/', json.dumps(model, separators=(',', ':')))
        .replace('/*RESULTS*/', json.dumps(results, ensure_ascii=False)))
open(os.path.join(root, 'index.html'), 'w', encoding='utf-8').write(html)
print('index.html', len(html) // 1024, 'KB')
