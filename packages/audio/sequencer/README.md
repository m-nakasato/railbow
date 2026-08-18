# KOBO Audio Sequencer

## API

## KMS (KOBO Musical Score Language)

KMS is musical score format for KOBO Audio Sequencer.

### 基本構文

- 音符の書き方
- 長さの書き方
- BPM の指定
- トラックの書き方
- ループやパターンの書き方（必要なら）
- 休符の表現

### parsedScore の構造

- measure / beat / note の階層
- データ構造の例

### compileScore の仕様

- 拍 → ミリ秒への変換
- events の構造
- 例：parsedScore → events の変換例

### Sequencer の役割

- start / stop
- rAF での進行管理
- Synth への委譲

### playScore の役割

- parsedScore → events
- events の消費
- noteOn の呼び出し
