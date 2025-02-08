# Agent Preparation Toolkit

## これは？
生成 AI における Agent をすぐに体感できるサンプル実装です。
Amazon Bedrock Agents を使ってすぐに Agent を動かすことができるほか、使用している Knowledge Bases のデータや Lambda 関数を差し替えたり付け加えたりすることで自社用の Agent にできます。

> [!IMPORTANT]
> Amazon Bedrock Agents で LLM が SQL を考えて Action Group に登録されている AWS Lambda の Lambda 関数が SQL を実行する仕組みです。  
> 本サンプルでは Lambda 関数上に立てている SQLite の DB に対してクエリを投げており、Lambda 関数上で INSERT や DROP の命令を除外する仕組みが入っています。  
> 実際には RDS や Athena などの DB に対してクエリを投げることもあると思いますので、そのときは Lambda のロールや、DB のユーザーに対して、SELECT (READ) 系の実行しかできないよう権限の制御をかけてください。

## 使い方

> [!NOTE]
> AWS のリージョンは `us-west-2` で動作確認しています。

> [!NOTE]
> デプロイする環境で docker daemon が動いている必要があります。  
> [colima](https://github.com/abiosoft/colima) で動作を確認しています。
> 事前に `colima start` をしておいてください。

```shell
# リポジトリの Clone
# URL は差し替える
git clone https://github.com/aws-samples/agent-preparation-toolkit

# カレントディレクトリをリポジトリに移す
cd agent-build-kit

# パッケージのインストール
npm install && cd custom-resources && npm ci && cd ..

# CDK Bootstrap
cdk bootstrap

# Agent のデプロイ
npm run cdk:deploy

# (待つ)
# CDK の出力にあるStackName = の後ろの値をコピーする
# 例: Dev-AgentPreparationToolkitStack.StackName = Dev-AgentPreparationToolkitStack

# DataSource の同期
python 1_sync.py -s {YOUR_STACK_NAME} # DataSource の同期が走る

# Agent 呼び出し
python 2_invoke.py 
```
