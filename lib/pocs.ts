export type Category = '業務' | 'ゲーム・自律世界' | '創作・UI' | '研究・実験';
export type DecisionType = 'Recommend' | 'Classify' | 'Prioritize' | 'Simulate' | 'Explain';
export type PocStatus = 'foreground' | 'coming-soon';
export type Poc = { slug:string; title:string; description:string; category:Category; decisionType:DecisionType; status:PocStatus; inputSchema:string; samples:string[]; specializedScreen?:string; evaluationAdapter:string };
type Seed = [string,string,Category,DecisionType,string,string,string,string];
const seeds: Seed[] = [
 ['reflex-arena','Reflex Arena','ゲーム・自律世界','Simulate','イベント列 + エージェント状態','反射神経エージェントの判断を再生','Arena replay','game-replay-v1'],
 ['tiny-world','Tiny World','ゲーム・自律世界','Simulate','世界状態 + ルール','小さな世界の自律エージェントを観察','World map','world-replay-v1'],
 ['ai-dj','AI DJ','創作・UI','Recommend','曲候補 + 気分 + 制約','気分と流れに合う選曲を再生','DJ console','playlist-rubric-v1'],
 ['living-ui','Living UI','創作・UI','Simulate','UI状態 + ユーザー意図','操作に応じて変化するUIを再生','Living canvas','ui-replay-v1'],
 ['browser-olympics','Browser Olympics','ゲーム・自律世界','Prioritize','Web課題 + 制約','ブラウザ課題に対するエージェントの試行を再生','Olympics scoreboard','browser-replay-v1'],
 ['accounting-category','勘定科目の振り分け','業務','Classify','取引摘要 + 勘定科目候補','取引を勘定科目へ振り分ける','Accounting table','label-v1'],
 ['csv-column-mapping','CSV列マッピング','業務','Recommend','CSVヘッダー + 期待スキーマ','CSV列を標準項目へマッピングする','Mapping table','mapping-v1'],
 ['search-reranking','検索リランキング','業務','Prioritize','検索結果 + クエリ + 評価軸','検索結果を意図に合わせて並べ替える','Ranking board','ranking-v1'],
 ['semantic-lint','コードの意味的lint','業務','Explain','コード差分 + ルール','コードの意味上のリスクを説明する','Code review','evidence-v1'],
 ['model-router','モデルルーター','業務','Recommend','リクエスト + コスト/品質制約','要求に適したモデル経路を選ぶ','Router matrix','routing-v1'],
 ['invoice-precheck','請求書の事前照合','業務','Classify','請求書 + 発注/検収データ','支払前に不一致を見つける','Invoice desk','evidence-v1'],
 ['amount-date-extraction','文書からの金額・日付選択','業務','Classify','文書本文 + 抽出スキーマ','文書中の候補から金額と日付を選ぶ','Extraction view','extraction-v1'],
 ['master-matching','取引先・商品マスタの照合','業務','Classify','入力行 + マスタ候補','取引先・商品の候補を照合する','Match table','matching-v1'],
 ['answer-evidence-check','回答と根拠の整合性チェック','業務','Explain','回答 + 根拠文書','回答が根拠と整合するか検査する','Evidence panel','grounding-v1'],
 ['tool-call-check','ツール呼び出しチェック','業務','Classify','ツール呼び出し列 + 許可仕様','ツール呼び出しの妥当性を検査する','Call trace','tool-safety-v1'],
 ['task-goal-linking','タスクと目標の関連付け','業務','Prioritize','タスク + 目標一覧','タスクがどの目標に寄与するか整理する','Goal graph','linking-v1'],
 ['breakdown-gap','ブレイクダウンの不足チェック','業務','Explain','目標 + タスク階層','計画の分解漏れを指摘する','Plan tree','rubric-v1'],
 ['incident-log','障害ログの分類と手順選択','業務','Recommend','障害ログ + 手順書','障害を分類し対応手順を選ぶ','Incident desk','runbook-v1'],
 ['paper-screening','論文スクリーニング','研究・実験','Classify','論文要旨 + 採択基準','研究レビューの候補をスクリーニングする','Paper queue','screening-v1'],
 ['demand-signals','需要シグナルの抽出','業務','Explain','時系列 + 外部シグナル','需要変化の兆候を抽出する','Signal chart','signal-v1'],
 ['ai-theater','AI Theater','研究・実験','Simulate','登場人物 + シーン制約','複数エージェントの舞台上の相互作用を観察','Stage view','theater-replay-v1'],
 ['rumor-lab','Rumor Lab','研究・実験','Simulate','主張 + 伝播ネットワーク','噂の伝播と検証を実験する','Rumor graph','simulation-v1'],
 ['black-box-scientist','Black Box Scientist','研究・実験','Explain','観測 + 仮説候補','ブラックボックスから仮説を組み立てる','Hypothesis lab','science-v1'],
 ['swarm-studio','Swarm Studio','研究・実験','Simulate','エージェント群 + 目的','群れの協調と分業を観察する','Swarm canvas','swarm-replay-v1'],
 ['evolution-arena','Evolution Arena','研究・実験','Simulate','個体群 + 評価関数','進化する戦略の世代推移を再生する','Evolution board','evolution-replay-v1'],
];
export const pocs: Poc[] = seeds.map(([slug,title,category,decisionType,inputSchema,sample,screen,adapter],i)=>({slug,title,description:`${title}の判断プロセスを、入力・出力・評価方法と一緒に確認します。`,category,decisionType,status:i<8?'foreground':'coming-soon',inputSchema,samples:[sample,'安全なデフォルト入力'],specializedScreen:screen,evaluationAdapter:adapter}));
export const categories: Array<'All'|Category> = ['All','業務','ゲーム・自律世界','創作・UI','研究・実験'];
export function getPoc(slug:string):Poc{return pocs.find(p=>p.slug===slug) as Poc}
