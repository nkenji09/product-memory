# product-memory (`pmem`)

**プロダクトの意思決定（decision）とその理由（why）を、実装の変更と結びつけて蓄積し、あとから評価するための土台。**

`pmem` は、コンポーネントやフローの詳細な振る舞いを、自由記述ではなく**語彙の組み合わせ**として記録する CLI ツールである。
コードやテストには「何をどう作ったか」は残るが、「なぜその設計にしたか」は揮発しやすい。
AI との協働や長期の継続開発では、この why の消失がとくに痛い。
過去の判断が読めないと、レビュー指摘を場当たりに直して以前の決定と矛盾させたり、同じ議論を何度も蒸し返したりする。

`pmem` は、テストやレビューを置き換えない。
その上に「決定と仕様の文脈層」を一枚足し、次の作業（人でも AI でも）が読み込んで守れる規則にする。
記録はすべて対象リポジトリ内の素の JSON として残り、コードと同じ版で git 管理される。
閲覧用のビューアは単一バイナリに同梱されるため、追加のランタイムやデータベースは要らない。

> 本ファイルはレビュー用の日本語ドラフトである。英語版 README は、この内容が固まってから作成する。

## コンセプト

`pmem` の設計は、次の中核原理から導かれる。

- **原子だけを保存し、構造は派生させる**：ファイルに保存する実体は**遷移（transition）**という原子だけである。
  1 つの遷移は `(action, given[], then[])`、つまり「きっかけ WHEN 条件 THEN 結果」で完結する。
  仕様、階層、グルーピングといった構造は保存せず、タグとクエリから読み取り時に導出する。
  「この仕様をどのファイルに分けるか」のような整理の判断を、利用者に強いない。
- **3 軸で分類する**：分類軸は**カテゴリ**（`condition`/`action`/`effect`。固定）、**kind**（カテゴリ内の分類。プロジェクトが宣言する）、**タグ**（横断分類。自由に付けられ、ネスト可能で、多値をとる）の 3 つに絞る。
  カテゴリを固定するから「構造化された振る舞いであって、ただのグラフではない」が保たれる。
- **git をデータベースにする**：1 レコードが 1 テキストファイルである（`.pmem/` 以下）。
  行を足す操作はファイルを足す操作なので git で衝突しない。
  履歴も diff もレビューも、専用の DB でなく git のまま回せる。
- **意思決定は append-only**：decision は消さず、直さない。
  訂正が要るときは新しい 1 件を足す。
  過去の判断が凍結されて残るから、変更を評価するときの基準になる。
- **語彙とタグは直交する**：**語彙（vocab）** は遷移のスロットを埋める構成部品で、消すと振る舞いが壊れる。
  **タグ（tag）** は振る舞いに貼るラベルで、分類や検索や要件トレーサビリティのための横断メタデータである。
  「tags classify; vocab composes.（タグは分類し、語彙は組み立てる）」

decision はタグにも付けられる。
複数の遷移をまたぐ不変条件は、共有タグに刻んでおく。
そうすると、片方の遷移を変更したときに、そのタグに付いた過去の decision が表に出て、もう片方との矛盾に気づける。

詳しい設計は [DESIGN.md](DESIGN.md) を参照。

## インストール

Go がある環境なら `go install` で入る。

```sh
go install github.com/nkenji09/product-memory/cmd/pmem@latest
```

プレビルドのバイナリ（darwin/linux/windows × amd64/arm64）は GitHub Releases から入手できる。
ビューアの SPA はバイナリに `//go:embed` で焼き込まれているため、`pmem` 1 つで CLI とビューアの両方が動く。

## クイックスタート

`.pmem/` を作り、語彙とタグと遷移を 1 つずつ足して、意思決定を記録するまでの最小の流れを示す。

```sh
# 1. プロジェクトに .pmem/ を作る
pmem init

# 2. 語彙（action / condition / effect）を足す
pmem vocab add action    act.user.submit-login   --label "ログイン送信" --kind user
pmem vocab add condition cond.credentials-valid  --label "資格情報が正当"
pmem vocab add effect    eff.session.issue-token --label "セッショントークン発行" --kind state --owner server

# 3. 横断分類のタグを足す
pmem tag create subject.auth --name "認証" --kind subject

# 4. 遷移（原子）を足す：WHEN ログイン送信 GIVEN 資格情報が正当 THEN トークン発行
pmem tx add T-login-submit-valid \
  --action act.user.submit-login \
  --given  cond.credentials-valid \
  --then   eff.session.issue-token \
  --tags   subject.auth

# 5. 意思決定（why）を記録する（append-only）
pmem decide --on transition:T-login-submit-valid \
  --why "トークンは httpOnly cookie で発行（XSS 対策）" --ref "PR#42"

# 6. 記録が自己矛盾していないか検査する
pmem lint

# 7. 主題タグで束ねた"仕様"レポートを見る（派生ビュー）
pmem spec subject.auth
```

手順 7 は、次のような派生レポートを表示する。

```
# 認証 (subject.auth)

## T-login-submit-valid
WHEN ログイン送信 GIVEN 資格情報が正当 THEN セッショントークン発行
decisions:
  - トークンは httpOnly cookie で発行（XSS 対策） (PR#42)
```

ブラウザで閲覧し評価するには、ローカルビューアを起動する。

```sh
pmem view   # http://127.0.0.1:4577 で開く
```

ビューアは、タグ階層のナビ、要件トレーサビリティ、そして未コミットの変更を過去の decision と突き合わせる評価ドロワーを備える。

> （TODO: viewer のスクリーンショット）

## レコードは CLI 経由で書く

`.pmem/` のファイルを直接エディタで書き換えない。
`pmem` が読み取りから書き込みまでを一貫して行い、正規化と不変条件チェック、decision の append-only 保証を担う。
手で書くとこの保証が崩れ、記録の信頼性が失われる。

## AI エージェント向け

`pmem rules` で「守るべき規則」を、`pmem decision list` で過去の判断を、機械可読な形で引ける。
`pmem show vocab <id>` は、その語彙を参照している遷移を逆引きする（安全にリファクタするための、真の影響集合）。
Claude 向けのスキル（`agents/skills/pmem/`）も同梱する。

## ライセンス

MIT License. [LICENSE](LICENSE) を参照。
