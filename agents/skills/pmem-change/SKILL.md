---
name: pmem-change
description: pmem の「変更を評価して取り込む」ワークフローを、コメントを受け取ってから decision に着地するまでの手順として実行する。UI コメントドロワーまたは端末で集めたレビューコメント（Tag の要件変更・Transition の実装との食い違い）を貼り付けて起動し、pmem・実装コードを人と読み合わせながら `.pmem/` を変更し、波及検索（Case 1）や兄弟 transition との整合（Case 2）を経て decision に着地させるときに使う。「このコメントを取り込んで」「Tag の要件が変わったので反映して」「Transition が実装とズレている」「この提案を評価して」等で起動する。
---

# pmem-change — 変更を評価して取り込む（Case 1: Tag / Case 2: Transition）

## これは何のためか

[pmem スキル](../pmem/SKILL.md) の「変更評価フロー」節は判定材料（複雑性 diff／既存 decision との矛盾／
既に検討済みか）を示すところまでを担う。本スキルはその先、**コメントを受け取ってから decision に着地するまでの
手順そのもの**を担当する（役割分担: 判定基準＝pmem スキル、手順＝本スキル。重複を避けるため判定材料の説明は
本スキルでは繰り返さず参照するだけに留める）。

**2 つのフローが使える**（landed した評価コックピット・DESIGN §7）:

- **CLI フロー**: 端末でコメントを集め、**コピーして本スキルを AI に貼り付ける**。以降は既存 CLI
  （`diff`/`rules`/`list`/`decide`/`decision add-commit`/`review`）とコメントの copy-paste で完結する。
- **viewer インライン評価フロー**: `pmem view` のコメントドロワーで、pending diff（作業ツリー vs `main`）を
  **差分カード付きの提案**として見ながら評価する。**提案＝変更を持つレコードのコメント・本文＝why**。
  AI は変更本体と対で `pmem review add` で**提案コメントを配送**（`.pmem/reviews/`・read-only オーバーレイ）、
  人は語彙ピッカーで手直し（vocab-only）し、ドロワーの **Adopt** で採用（`POST /api/decision`）＝why を decision へ昇格する。

どちらのフローでも**着地の正本は decision（append-only）**で、判定材料と結着ルールは同じ。以下の手順は
CLI を軸に書くが、viewer を使う場合も同じ順序（提案 → コメント/手直し → 評価 → decide → commit → 結線）で進む。

## いつ使うか

- Tag（要件）の中身が変わった、というレビューコメントを受け取ったとき（**Case 1**）。
- Transition が実装・要件とズレている、というレビューコメントを受け取ったとき（**Case 2**）。
- 「この提案を取り込むべきか」を pmem の過去 decision と突き合わせて判断したいとき。

## task の考え方（1 変更 = 1 task）

1 つの修正は複数レコード（tag／transition／vocab）に跨ることが多い。**1 変更 ＝ 1 task（軽い作業単位）**として
扱い、跨る複数レコードは同一 task に集約する。着地時は **「1 task 1 commit 1 decision」を推奨形**とする
（強制ではない）。

- task はコード上の概念ではなく、**このスキルのセッション内で人と AI が共有する作業のまとまり**。
- 1 decision に複数コミットを許すのは自然（`pmem decision add-commit` で足す）。
- **実装ミス直し（判断は変わらない）は decision を増やさず、既存 decision に commit を足す。**
  別の判断が入ったときだけ新しい decision を足す（`pmem decide`）。decision の無駄な増殖は見づらさに直結するため
  避ける（DESIGN §3.5）。

## 共通の入口

1. UI のコメントドロワーまたは端末で集めたレビューコメントを、この場に貼り付けてもらう。
2. コメントが指す対象（tag/transition の id）と、この変更が **Case 1（Tag の要件変更）** か
   **Case 2（Transition の修正）** かを確認する。両方に跨る場合は 1 task に集約し、両方の手順を順に踏む。

## Case 1: Tag の要件変更

提供体験・要件そのものが変わったとき。

1. **入口理解** — コメントを読み、`pmem show tag <id>` と `pmem rules --tag <id>`（過去 decision＝守る規則）で
   現状を把握する。
2. **Tag に decide** — 人と対話し、要件変更の why を確定してから記録する（cross-cutting 不変条件の更新）:
   ```
   pmem decide --on tag:<id> --why "<要件変更の理由>" --ref <PR/URL>
   ```
3. **波及検索（核心）** — そのタグが波及する範囲を洗う:
   ```
   pmem list --tag <id>          # 実効タグにこの tag を含む transition を列挙（子タグ経由のヒットも拾う）
   pmem rules --tag <id>         # 既存 decision と照合（矛盾は却下寄り・矛盾する decision の id を引用）
   ```
   vocab 側の波及は `vocab` に一覧コマンドが無いため `grep -l '"tags"' .pmem/vocab/*.json` のように直接
   確認して補う。**影響先は全部同じ task に集約する。**
4. **`.pmem/` を編集** — 影響先の transition／vocab をブランチ上で変更する。
   **AI が変更したら、対で提案コメント（why）を配送する**（viewer で見えるようにする・DESIGN §8.4）:
   ```
   pmem review add --on tag:<id> --body "<この変更の why・提案理由>"
   pmem review add --on transition:<id> --body "<why>"   # 影響先ごとに
   ```
5. **提案 diff を出す**:
   ```
   pmem diff                     # 作業ツリー vs base（pending task の diff）
   pmem diff <ref1> <ref2>       # 着地後の landed task を再現したいとき（例: <commit>^ <commit>）
   ```
6. **人がレビュー** — viewer のドロワー（差分カード＋提案コメント）／端末で diff とコメントを見比べる。
   調整があれば手順 4〜5 に戻り `.pmem/` を編集し直す（viewer では語彙ピッカーで vocab-only の手直しも可）。
7. **確定したら decide** — 影響先の transition／tag それぞれに:
   ```
   pmem decide --on transition:<id> --why "<変更の理由>" --changed "<変更内容>" --ref <PR/URL>
   ```
8. **commit（意味単位）** — `.pmem/` の変更を 1 つの意味単位コミットにまとめる。
9. **decision に着地 commit を結ぶ**:
   ```
   pmem decision add-commit <decisionId> <hash>
   ```
   decide 時点で commit のハッシュが既に分かっているなら、手順 7 で `pmem decide --commit <hash>` として
   最初から結んでもよい（9 は省略できる）。
10. **実装/テスト側へ** — 人が task の diff／コメントをコピーし、pmem の外（コード側）の実装・テスト修正を依頼する。

## Case 2: Transition の修正

要件と実装の食い違い・不足が指摘されたとき。

1. **入口** — Transition を指すコメント（要件 vs 実際の transition の齟齬）を読む。
2. **読解** — `pmem show tx <id> --resolve` と実装コードを読み、人と対話して変更提案を固める。
3. **`.pmem/` を編集** — transition（`given`/`then`/`tags` 等）を変更する。
   **AI が変更したら対で提案コメントを配送**: `pmem review add --on transition:<id> --body "<why>"`（DESIGN §8.4）。
4. **提案 diff を出す** — `pmem diff`（作業ツリー vs base）。viewer では当該 transition のドロワーに差分カードが出る。
5. **人がレビュー** — 提案・コメントを見比べる（viewer の語彙ピッカーで vocab-only 手直しも可）。調整があれば手順 3〜4 に戻る。
6. **完了ゲート（必須・DESIGN §8）— 兄弟 transition との整合**:
   同じ主題タグ配下の兄弟 transition を全部洗い、同種の食い違いが残っていないか 1 周確認する:
   ```
   pmem list --tag <subjectTag>   # 同じ主題タグの transition を横断列挙
   pmem spec <subjectTag>         # 主題タグで束ねた仕様レポート（WHEN/GIVEN/THEN を並べて見る）
   ```
   **`pmem lint` が緑でも網羅の証明にはならない**（DESIGN §5・§8）。ここは手動の突合として別に行う。
7. **確定したら decide** — 変更した transition ごとに:
   ```
   pmem decide --on transition:<id> --why "<変更の理由>" --changed "<変更内容>" --ref <PR/URL>
   ```
8. **commit → 結線**:
   ```
   pmem decision add-commit <decisionId> <hash>
   ```
9. **実装/テスト側へ** — 人が task のコンテキストをコピーし、実装・テスト修正を依頼する。

## adopt / reject の判断

[pmem スキル](../pmem/SKILL.md) の判定材料（複雑性 diff／既存 decision との矛盾／既に検討済みか）を
そのまま使う。詳細はそちらを参照し、ここでは結着の 2 通りだけを手順に接続する:

- **adopt** — 変更を採用（git の commit/merge は人が行う）＋「採用」の decision を append。CLI なら `pmem decide`、
  viewer なら提案コメントの **Adopt**（`POST /api/decision`＝コメント本文 why を decision へ昇格）。手順は Case 1/2 の 7〜9 の通り。
- **reject** — 採用しない ＋「取り込まない・理由」の decision を append する。一言で済ませず、
  次回同じ提案が来たときの既決になるよう根拠を why に残す（矛盾する decision があれば id を引用する）。

## 完了条件

- コメントの対象を Case 1／Case 2 に分類し、跨る場合は 1 task に集約している。
- Case 1: `pmem rules --tag` で守る規則を確認し、`pmem list --tag` の波及検索で影響先を洗い出している。
- Case 2: 完了ゲート（同じ主題タグの兄弟 transition との整合・手順 6）を通している。
- adopt/reject いずれも decision を why 付きで記録し、着地 commit が `commits[]` に結ばれている
  （`decide --commit` または `decision add-commit`）。
- 実装ミス直しで decision を無駄に増やしていない（`add-commit` で足りるケースは増やさず足りている）。
- 人が task の diff／コメントをコピーし、pmem の外（実装/テスト）の修正依頼まで橋渡ししている。

## 関連

- 判定材料・日々の読み書きコマンドは [pmem スキル](../pmem/SKILL.md)（変更評価フロー節）。
- 新規プロジェクトの初回セットアップは [pmem-config-setup スキル](../pmem-config-setup/SKILL.md)（本スキルの範囲外）。
- decision の `commits[]` ／ append-only の精緻化（判断は不変・`commits[]` のみ追記専用）は `DESIGN.md` §3.5 が正本。
- `pmem diff` の ref 対 ref 拡張・`pmem review`・CLI 全体は `DESIGN.md` §6 が正本（`pmem <cmd> --help` も真値）。
- 評価コックピット（viewer のインライン評価・提案＝コメント・語彙ピッカー手直し・Adopt・AI コメント配送）は
  `DESIGN.md` §7・§8.4 が正本。
