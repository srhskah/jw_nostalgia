# 任务：实现一个「HEISEI-VHS 风格」的图片 VHS 复古劣化工具

## 角色
你是一名资深前端图形工程师，精通 WebGL / GLSL shader、Canvas 2D 以及 React（或原生 JS，见技术栈约束）。你需要从零实现一个**纯前端、本地处理**的图片 VHS 滤镜工具，功能参考 https://hiyameshi-retro-pack.web.app/apps/Heisei-VHS/ 。

## 参考目标的已知特征
HEISEI-VHS 将上传图片模拟为“平成初期录像带转录到早期互联网”的劣化画质，其核心效果由以下视觉伪影叠加构成[reference:0][reference:1]：

1. **Tracking lines / tape wave**：水平方向的漂移扭曲带，缓慢上下滚动
2. **Head-switching noise**：画面底部或特定位置出现的横向噪声条带
3. **Chroma shift / chroma bleed**：R/B 通道相对 G 通道的水平偏移，边缘出现色彩“溢出”
4. **Chroma noise**：色度信号上的彩色噪点
5. **Grain / static noise**：模拟信号嘶声，暗部更明显
6. **Scanlines**：CRT 扫描线
7. **Vignette**：画面四角压暗
8. **Barrel distortion**（可选）：CRT 显像管曲率
9. **Saturation / exposure 偏移**：整体色彩变淡或偏色
10. **Compression artifacts / ringing**：数字压缩带来的块状伪影和振铃噪声

原工具提供约 **23 种可调劣化参数**，参数调整时实时反映到预览[reference:2]。你的实现不需要 1:1 复刻全部 23 项，但必须覆盖上述视觉伪影的核心类别，并提供足够细腻的调节能力。

## 功能需求

### 1. 图片导入
- 支持拖放（drag & drop）和点击选择文件两种方式导入图片。
- 支持常见格式：JPEG、PNG、WebP。
- 图片导入后立即在预览画布中显示，并自动应用默认的 VHS 劣化效果（“开箱即用”的默认参数应已具备明显的平成 VHS 质感）。
- **全部处理必须在浏览器本地完成，不上传任何图片数据到服务器。** 这一点与原工具一致，也是必须满足的隐私要求[reference:3]。

### 2. 参数控制面板
- 提供一个侧边面板（可折叠），列出可调节的劣化参数。
- 每个参数使用滑杆（range input）控制，并实时更新预览（无需点击“应用”按钮）。
- 每个参数旁应有名称和简短 tooltip / 说明，解释该参数控制什么视觉效果。
- 必须包含以下参数类别（可根据实现细节适当合并或拆分，但视觉效果不得缺失）：

| 参数类别 | 作用 | 参考范围 |
|---|---|---|
| Wave / Tape wave | 水平漂移扭曲强度 | 0 – 3 |
| Jitter | 逐行水平抖动强度 | 0 – 3 |
| Crease | 移动的折痕带强度 | 0 – 3 |
| Switching / Head-switching | 底部切换噪声强度 | 0 – 3 |
| Switching height | 切换噪声带高度占比 | 0 – 0.1 |
| Aberration / Chroma shift | R/B 通道水平偏移像素数 | 0 – 10 px（随 DPR 缩放） |
| Chroma noise | 色度噪声强度 | 0 – 1 |
| Grain | 静态颗粒噪声强度 | 0 – 1 |
| Scanlines | 扫描线强度 | 0 – 1 |
| Vignette | 四角压暗强度 | 0 – 1 |
| Barrel | CRT 曲率（桶形畸变） | 0 – 1 |
| Saturation | 饱和度 | 0 – 1（或 0–2） |
| Exposure | 亮度偏移 | 0.5 – 1.5 |
| Compression | 压缩劣化强度（块状/振铃） | 0 – 1 |

你可以参考 Canvas UI VHS 组件的 uniform 设计来组织 shader 参数，上述范围与其默认值体系兼容[reference:4]。

- 提供“重置为默认”按钮。
- 参数变化时，**预览必须流畅**（目标 60fps 或接近；静态图片场景下可优化为仅在参数变化时重绘，不必持续 RAF 循环，但涉及时间动画的效果如 wave / jitter / switching 需要持续动画）。

### 3. 预览与导出
- 预览画布应尽可能贴合原图宽高比，支持高 DPI 屏幕（devicePixelRatio）。
- 提供“导出图片”按钮，将当前效果以 PNG 格式下载到本地。
- 导出分辨率应与原始图片一致（或至少不低于原始分辨率，若实现上有性能考量，可提供“导出高清”选项）。

### 4. UI / 交互风格
- 整体走复古/工具感路线，参考原工具的干净实用风格：深色或中性背景，参数面板清晰可读。
- 无需过度设计；功能可用性和效果真实感优先于视觉花哨。
- 响应式：桌面端侧边参数面板 + 中央预览；移动端可折叠参数面板。

## 技术实现约束与建议

### 技术栈
- **必须使用 WebGL 进行效果渲染**。Canvas 2D + CSS filter 无法实现真实的逐像素色度偏移和时间性 tape 伪影[reference:5]。
- 推荐使用 **原生 WebGL + GLSL fragment shader**，不强制依赖 Three.js；若选择 Three.js，应说明理由并保持依赖轻量。
- 框架选择：React（推荐，便于参数面板状态管理）或原生 JS。若使用 React，不要引入大型 UI 库；滑杆等控件可原生实现或使用极轻量方案。
- 禁止使用任何需要上传图片到服务器的库或 API。

### Shader 核心逻辑指引
在 fragment shader 中，按以下顺序或类似管线实现效果（可根据视觉调优调整顺序）：

1. 采样原始纹理，获取 base color。
2. 应用 **barrel distortion**（若启用）：根据桶形系数扭曲 UV。
3. 应用 **tape wave / crease**：基于 `uTime` 和 UV.y 产生水平 UV 偏移。
4. 应用 **chroma shift / aberration**：分别采样 R、G、B 通道，R 和 B 在水平方向偏移若干像素。
5. 应用 **jitter**：逐行（或基于噪声 hash）加入微小水平偏移。
6. 应用 **head-switching noise**：在画面底部一个窄带内加入强噪声或横向撕裂。
7. 应用 **grain**：基于噪声函数叠加亮度噪声，暗部权重更高。
8. 应用 **chroma noise**：在色度信号上叠加彩色噪声。
9. 应用 **scanlines**：`sin(UV.y * scanlineCount)` 调制亮度。
10. 应用 **compression / ringing**（可选）：对颜色做量化或引入振铃边缘。
11. 应用 **vignette**：基于到中心的距离压暗四角。
12. 应用 **saturation / exposure** 最终调色。

时间动画参数（wave、jitter、switching、crease 等）应通过 `requestAnimationFrame` 更新 `uTime` uniform 来驱动。

### 性能与边界情况
- 大图（如 4K）需要处理纹理尺寸限制：检查 `MAX_TEXTURE_SIZE`，必要时对预览图降采样，但导出时尽可能使用原图尺寸或提供可选的导出分辨率[reference:6]。
- 参数变化时避免不必要的全量重建 shader program；使用 uniform 更新。
- 提供“暂停动画”选项（若实现持续 RAF），以便用户精细调节静态参数。
- 处理非图片文件、超大文件时的友好错误提示。

## 验收标准
完成后应满足：

1. 拖放一张普通照片（如风景照、人像照）到页面，立即看到具有明显“平成 VHS 录像带转录”质感的输出，无需手动调整参数。
2. 调节任何一个滑杆，预览在 100ms 内发生可见变化。
3. 调节 Chroma shift / Aberration 参数时，可清楚看到颜色在边缘处分离。
4. 调节 Grain / Scanlines 时，可看到对应的颗粒感和扫描线叠加。
5. 导出的 PNG 与预览在视觉上一致，且分辨率不低于原始图片（或由用户选择的导出分辨率）。
6. 打开 DevTools Network 面板，导入和处理过程中没有任何图片上传请求。
7. 页面在 Chrome / Edge / Firefox 最新版中可用。

## 交付物
- 完整可运行的源代码（HTML / CSS / JS 或 React 项目）。
- 如果使用构建工具，提供 `npm install` 和 `npm run dev` 即可启动的配置。
- 代码中关键 shader 段落和参数逻辑应有注释，说明其对应哪种 VHS 视觉伪影。