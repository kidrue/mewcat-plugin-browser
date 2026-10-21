# 晴空来信 · Options 素材与提示词

本轮使用内置 image_gen 生成，新增 5 张场景、4 枚透明底插画图标、1 张阅读肖像。资源位于 `src/public/assets/sky-letter/`，通过 `SkyArtwork` 统一解析扩展本地路径。原有 `sky-post-office.png` 与 `chengyu.png` 保留。

[打开素材预览册](./materials-preview.html)

## 接入与使用

| 文件                   | 画面                       | 使用位置                             |
| ---------------------- | -------------------------- | ------------------------------------ |
| `cloud-coast.png`      | 海岸与晴空                 | 翻译服务、基础配置、关于页的宽幅背景 |
| `reading-desk.png`     | 窗边写信桌                 | 划词翻译、阅读与测试卡片             |
| `hydrangea-garden.png` | 绣球花圃                   | 图片翻译与网站范围卡片               |
| `blue-postcards.png`   | 海风明信片                 | 翻译服务、连接配置与统计来源         |
| `letter-archive.png`   | 来信档案室                 | 用量统计、请求控制、本地缓存         |
| `icon-mail.png`        | 信封与纸飞机               | 服务与连接标题                       |
| `icon-book.png`        | 词典与书签                 | 阅读与交互标题                       |
| `icon-picture.png`     | 海岸与花卉明信片           | 图片翻译标题                         |
| `icon-ledger.png`      | 蓝色统计账本               | 请求控制与用量标题                   |
| `chengyu-reading.png`  | 澄羽阅读肖像，浅蓝不透明底 | 关于页的阅读工具卡片                 |

图标原稿为 1254×1254 RGBA，正文卡片显示 52px、页头显示 64px。图标保留真实 alpha，不用于替换 16–24px 的操作图标。5 张场景为 1536×1024 RGB，肖像为 1024×1536 RGB。肖像修正为浅蓝底画面，不宣称为透明立绘。

卡片以 98%→95%→82% 的白色遮罩压低背景对比，避免干扰正文。装饰图标使用空 alt、aria-hidden、pointer-events:none；卡片主体不添加 overflow:hidden 或新的堆叠上下文，保留下拉和焦点。窄屏合并为单列，并隐藏关于页的侧边肖像。

## 场景复用提示词

以下为按已验收画面整理的复用版本；新增场景应保持相同蓝白色调、左上晨光与邮局物件语言。实际素材中的构图以文件为准。

### 海岸与晴空 · cloud-coast.png

清透日系二次元场景，海边山坡的白墙蓝顶邮局、淡蓝海面与层云、蓝白邮箱与一架纸飞机；左侧45%浅色天空留白，细节集中右侧，左上晨光，1536×1024，无文字、人物、Logo、水印或UI。

### 窗边写信桌 · reading-desk.png

清透日系二次元插画，晴空邮局内部白色写信桌、打开的空白书本、蓝色钢笔与小花瓶、望向海面的窗；主体与花瓶偏右，左侧45%为低细节浅色纸面，蓝白配色、柔和左上晨光，1536×1024，无可读文字、人物、水印或UI。

### 绣球花圃 · hydrangea-garden.png

晴空邮局花园，蓝色绣球、蓝白邮箱、白色围栏、海岸与积云；白色和浅蓝为主，小面积绿色，右侧细节丰富、左侧45%低细节留白，清透日系插画与细腻赛璐璐光影，1536×1024，无文字、人物、Logo、水印或UI。

### 海风明信片 · blue-postcards.png

俯拍的白色邮局桌面，象牙白信封、蓝色无字邮票、雾蓝缎带、蓝色绣球和纸飞机，精致纸张质感，蓝白主色、微量暖金；物件集中在右侧、左侧45%纸面留白，清透日系手绘，1536×1024，无文字、水印或UI。

### 来信档案室 · letter-archive.png

晴空邮局档案室，白木书架、蓝色账本、整齐信封与档案纸，窗外海天；安静左上晨光，蓝白色调，构图右侧丰富左侧45%明亮留白，清透日系二次元插画，1536×1024，无可读文字、人物、Logo、水印或UI。

## 独立图标提示词

以下为按最终素材整理的独立复用提示词，每次调用只生成一枚图标。

### icon-mail.png

生成一枚晴空邮局主题插画图标：打开的象牙白信封、蓝色邮票与一架浅蓝纸飞机，细小暖金星星点缀。真实透明 alpha 背景，独立方形画布，居中构图，四周12%安全边距，清透日系细线稿、柔和上色、左上晨光，64px 显示时轮廓仍清晰。无文字、水印、场景或徽章底板。

### icon-book.png

生成一枚晴空阅读主题插画图标：打开的雾蓝封面词典、空白奶白书页、深蓝书签与一朵小蓝色绣球，少量暖金包角。真实透明 alpha 背景，独立方形画布，居中俯视构图，四周12%安全边距，清透日系细线稿、柔和上色、左上晨光，64px 显示时轮廓仍清晰。无文字、水印、场景或徽章底板。

### icon-picture.png

生成一枚晴空图片主题插画图标：两张略微交叠的象牙白即时照片，正面照片是蓝色海岸、白云与温和阳光，后方照片是蓝色绣球花，一枚浅蓝回形针固定上角。真实透明 alpha 背景，独立方形画布，居中构图，四周12%安全边距，清透日系线稿、柔和上色、左上晨光。无文字、人物、相机、水印、场景或徽章底板。

### icon-ledger.png

生成一枚晴空统计主题插画图标：合拢的雾蓝账本、奶白纸边、深蓝书签和一枚暖金星形挂饰，一张纸露出三个从低到高的蓝色柱形图，不含数字。真实透明 alpha 背景，独立方形画布，居中三分之四视角，四周12%安全边距，清透日系细线稿、柔和上色、左上晨光。无文字、水印、场景或徽章底板。

## 澄羽阅读肖像

使用既有 `chengyu.png` 作为人物设定参考。初始阅读变体与透明处理稿因棋盘格背景未通过接入检查；最终采用浅蓝底肖像。

### 阅读姿态

使用既有澄羽作为人物设计参考：成年女性、银白及肩短发与浅蓝发梢、青蓝眼睛、角色左侧纸飞机发夹、白色云纹短斗篷、雾蓝连衣裙、深蓝细领结。改为双手自然持打开的蓝色手账阅读，眼神朝向书页并带放松微笑；头部、头发、斗篷与双手完整保留在画面内。保持原角色细线稿、柔和赛璐璐上色、左上晨光；无文字、水印。最终版本使用明亮浅蓝不透明底作为独立肖像卡片。

### 最终背景修正

Use case: precise-object-edit. Edit the attached anime reading portrait by replacing ONLY the entire gray checkerboard background with a clean pale sky-blue (#EFF8FF) matte paper background, with a very faint white cloud in the upper right corner. This is an opaque portrait illustration for a rectangular web card, NOT a transparent cutout. Completely remove all checkerboard squares from the background, also the holes between hair strands and cape. Preserve the exact adult woman, face, blue eyes, white hair with blue tips, airplane clip, white cloud-embroidered cape, blue dress, blue notebook, hands, reading pose, proportions, clean linework, colors and original canvas crop unchanged. No text, no watermark, no symbols, no new objects. Smooth bright background with no dark edges.
