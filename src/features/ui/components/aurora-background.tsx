// 全屏极光底层：固定定位、z-index 负值，作为所有页面的氛围背景。
// 纯装饰、绝不承载内容（aria-hidden）；颜色与漂移动画都定义在 app.css 的
// .aurora-* 规则里——本文件不出现任何颜色值，hex 的唯一真相源是中央样式表。
export const AuroraBackground = () => (
  <div class="aurora-canvas" aria-hidden="true">
    <div class="aurora-blob aurora-blob--cyan" />
    <div class="aurora-blob aurora-blob--violet" />
    <div class="aurora-blob aurora-blob--magenta" />
    <div class="aurora-blob aurora-blob--teal" />
  </div>
);
