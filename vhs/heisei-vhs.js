/**
 * HEISEI-VHS：本地 WebGL 平成 VHS 劣化（无上传）
 * 供 Classic / Aero 共用；默认由页面侧决定是否启用。
 */
(function (global) {
  'use strict';

  var DEFAULTS = {
    wave: 1.2,
    jitter: 0.8,
    crease: 0.55,
    switching: 1.0,
    switchingHeight: 0.045,
    aberration: 2.5,
    chromaNoise: 0.28,
    grain: 0.38,
    scanlines: 0.42,
    vignette: 0.38,
    barrel: 0.12,
    saturation: 0.82,
    exposure: 1.06,
    compression: 0.22,
    pauseAnim: false
  };

  var PARAM_META = [
    { key: 'wave', label: 'Tape wave', title: '水平漂移扭曲强度', min: 0, max: 3, step: 0.01 },
    { key: 'jitter', label: 'Jitter', title: '逐行水平抖动', min: 0, max: 3, step: 0.01 },
    { key: 'crease', label: 'Crease', title: '移动折痕带', min: 0, max: 3, step: 0.01 },
    { key: 'switching', label: 'Head switching', title: '底部磁头切换噪声', min: 0, max: 3, step: 0.01 },
    { key: 'switchingHeight', label: 'Switching height', title: '切换噪声带高度占比', min: 0, max: 0.1, step: 0.001 },
    { key: 'aberration', label: 'Chroma shift', title: 'R/B 通道水平偏移（px）', min: 0, max: 10, step: 0.1 },
    { key: 'chromaNoise', label: 'Chroma noise', title: '色度噪声', min: 0, max: 1, step: 0.01 },
    { key: 'grain', label: 'Grain', title: '颗粒/嘶声噪声', min: 0, max: 1, step: 0.01 },
    { key: 'scanlines', label: 'Scanlines', title: 'CRT 扫描线', min: 0, max: 1, step: 0.01 },
    { key: 'vignette', label: 'Vignette', title: '四角压暗', min: 0, max: 1, step: 0.01 },
    { key: 'barrel', label: 'Barrel', title: '显像管桶形畸变', min: 0, max: 1, step: 0.01 },
    { key: 'saturation', label: 'Saturation', title: '饱和度', min: 0, max: 2, step: 0.01 },
    { key: 'exposure', label: 'Exposure', title: '曝光/亮度', min: 0.5, max: 1.5, step: 0.01 },
    { key: 'compression', label: 'Compression', title: '压缩块状/振铃', min: 0, max: 1, step: 0.01 }
  ];

  var VERT = [
    'attribute vec2 a_pos;',
    'varying vec2 v_uv;',
    'void main(){',
    '  v_uv = a_pos * 0.5 + 0.5;',
    '  v_uv.y = 1.0 - v_uv.y;',
    '  gl_Position = vec4(a_pos, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FRAG = [
    'precision mediump float;',
    'varying vec2 v_uv;',
    'uniform sampler2D u_tex;',
    'uniform vec2 u_res;',
    'uniform float u_time;',
    'uniform float u_wave;',
    'uniform float u_jitter;',
    'uniform float u_crease;',
    'uniform float u_switching;',
    'uniform float u_switchingHeight;',
    'uniform float u_aberration;',
    'uniform float u_chromaNoise;',
    'uniform float u_grain;',
    'uniform float u_scanlines;',
    'uniform float u_vignette;',
    'uniform float u_barrel;',
    'uniform float u_saturation;',
    'uniform float u_exposure;',
    'uniform float u_compression;',
    'float hash(vec2 p){',
    '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);',
    '}',
    'float noise(vec2 p){',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  float a = hash(i);',
    '  float b = hash(i + vec2(1.0, 0.0));',
    '  float c = hash(i + vec2(0.0, 1.0));',
    '  float d = hash(i + vec2(1.0, 1.0));',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;',
    '}',
    'vec2 barrel(vec2 uv, float amt){',
    '  vec2 c = uv * 2.0 - 1.0;',
    '  float r2 = dot(c, c);',
    '  c *= 1.0 + amt * r2;',
    '  return c * 0.5 + 0.5;',
    '}',
    'void main(){',
    '  vec2 uv = v_uv;',
    '  if (u_barrel > 0.001) uv = barrel(uv, u_barrel * 0.35);',
    '  float t = u_time;',
    '  float wave = sin(uv.y * 28.0 + t * 2.2) * 0.004 * u_wave;',
    '  wave += sin(uv.y * 9.0 - t * 1.1) * 0.0025 * u_wave;',
    '  float creaseY = fract(t * 0.08);',
    '  float creaseBand = smoothstep(0.0, 0.02, abs(uv.y - creaseY));',
    '  creaseBand = 1.0 - creaseBand;',
    '  float crease = creaseBand * 0.012 * u_crease;',
    '  float line = floor(uv.y * u_res.y);',
    '  float jit = (hash(vec2(line, floor(t * 60.0))) - 0.5) * 0.006 * u_jitter;',
    '  uv.x += wave + crease + jit;',
    '  float px = u_aberration / max(u_res.x, 1.0);',
    '  float r = texture2D(u_tex, uv + vec2(px, 0.0)).r;',
    '  float g = texture2D(u_tex, uv).g;',
    '  float b = texture2D(u_tex, uv - vec2(px, 0.0)).b;',
    '  vec3 col = vec3(r, g, b);',
    '  float switchZone = 1.0 - smoothstep(0.0, u_switchingHeight + 0.0001, uv.y);',
    '  if (u_switching > 0.001 && switchZone > 0.0) {',
    '    float tear = (hash(vec2(floor(uv.x * u_res.x * 0.25), floor(t * 40.0))) - 0.5) * 0.04 * u_switching;',
    '    vec3 sn = vec3(',
    '      hash(uv * u_res + t),',
    '      hash(uv * u_res + t + 17.0),',
    '      hash(uv * u_res + t + 31.0)',
    '    );',
    '    col = mix(col, sn, switchZone * clamp(u_switching * 0.45, 0.0, 1.0));',
    '    col.r = texture2D(u_tex, uv + vec2(tear + px, 0.0)).r;',
    '    col.g = texture2D(u_tex, uv + vec2(tear, 0.0)).g;',
    '    col.b = texture2D(u_tex, uv + vec2(tear - px, 0.0)).b;',
    '  }',
    '  float dark = 1.0 - dot(col, vec3(0.299, 0.587, 0.114));',
    '  float grainN = (noise(uv * u_res * 0.55 + t * 8.0) - 0.5) * u_grain * (0.45 + dark);',
    '  col += vec3(grainN);',
    '  vec3 cN = vec3(',
    '    noise(uv * 90.0 + t),',
    '    noise(uv * 95.0 + t * 1.3),',
    '    noise(uv * 100.0 + t * 0.7)',
    '  ) - 0.5;',
    '  col += cN * u_chromaNoise * 0.35;',
    '  float scan = sin(uv.y * u_res.y * 3.14159265) * 0.5 + 0.5;',
    '  col *= 1.0 - u_scanlines * (1.0 - scan) * 0.55;',
    '  if (u_compression > 0.001) {',
    '    float block = 8.0 + floor(u_compression * 24.0);',
    '    vec2 buv = floor(uv * u_res / block) * block / u_res;',
    '    vec3 bcol = texture2D(u_tex, buv).rgb;',
    '    col = mix(col, bcol, u_compression * 0.35);',
    '    float ring = abs(col.g - bcol.g);',
    '    col += vec3(ring) * u_compression * 0.65;',
    '  }',
    '  float vig = distance(uv, vec2(0.5));',
    '  col *= 1.0 - smoothstep(0.35, 0.95, vig) * u_vignette;',
    '  float luma = dot(col, vec3(0.299, 0.587, 0.114));',
    '  col = mix(vec3(luma), col, u_saturation);',
    '  col *= u_exposure;',
    '  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      var info = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(info || 'shader compile failed');
    }
    return sh;
  }

  function createProgram(gl, vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p) || 'program link failed');
    }
    return p;
  }

  function cloneDefaults() {
    var o = {};
    for (var k in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) o[k] = DEFAULTS[k];
    }
    return o;
  }

  /**
   * @param {object} opts
   * @param {HTMLImageElement} opts.imgEl
   * @param {HTMLElement} opts.previewHost  预览图所在容器
   * @param {HTMLElement} opts.panelHost    参数面板挂载点
   * @param {'classic'|'aero'} opts.theme
   */
  function mount(opts) {
    if (!opts || !opts.imgEl || !opts.previewHost || !opts.panelHost) {
      throw new Error('HeiseiVHS.mount: missing required options');
    }

    var imgEl = opts.imgEl;
    var theme = opts.theme === 'aero' ? 'aero' : 'classic';
    var params = cloneDefaults();
    var enabled = false;
    var rafId = 0;
    var startTs = 0;
    var texture = null;
    var hasImage = false;
    var sourceW = 0;
    var sourceH = 0;

    var canvas = document.createElement('canvas');
    canvas.id = 'vhs-canvas';
    canvas.className = 'vhs-canvas';
    canvas.style.display = 'none';
    canvas.style.maxWidth = '100%';
    canvas.style.verticalAlign = 'middle';
    opts.previewHost.appendChild(canvas);

    var gl = canvas.getContext('webgl', {
      preserveDrawingBuffer: true,
      alpha: false,
      antialias: false
    });
    if (!gl) {
      console.error('HeiseiVHS: WebGL unavailable');
      return { destroy: function () {} };
    }

    var program = createProgram(gl, VERT, FRAG);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1
    ]), gl.STATIC_DRAW);

    var aPos = gl.getAttribLocation(program, 'a_pos');
    var uniforms = {};
    [
      'u_tex', 'u_res', 'u_time', 'u_wave', 'u_jitter', 'u_crease', 'u_switching',
      'u_switchingHeight', 'u_aberration', 'u_chromaNoise', 'u_grain', 'u_scanlines',
      'u_vignette', 'u_barrel', 'u_saturation', 'u_exposure', 'u_compression'
    ].forEach(function (name) {
      uniforms[name] = gl.getUniformLocation(program, name);
    });

    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    function maxTexSize() {
      return gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
    }

    function uploadImage() {
      if (!imgEl || !imgEl.naturalWidth) {
        hasImage = false;
        return;
      }
      var max = maxTexSize();
      var w = imgEl.naturalWidth;
      var h = imgEl.naturalHeight;
      sourceW = w;
      sourceH = h;
      var scale = 1;
      if (w > max || h > max) {
        scale = Math.min(max / w, max / h);
      }
      // 预览纹理可适度降采样，导出时再按原图重绘
      var previewMax = 1600;
      if (Math.max(w, h) * scale > previewMax) {
        scale = Math.min(scale, previewMax / Math.max(w, h));
      }
      var tw = Math.max(1, Math.floor(w * scale));
      var th = Math.max(1, Math.floor(h * scale));
      canvas.width = tw;
      canvas.height = th;

      gl.bindTexture(gl.TEXTURE_2D, texture);
      try {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgEl);
        hasImage = true;
      } catch (err) {
        console.warn('HeiseiVHS: texture upload failed', err);
        hasImage = false;
      }
      syncVisibility();
      if (enabled && hasImage) requestDraw(true);
    }

    function setUniformParams(timeSec) {
      gl.uniform1f(uniforms.u_time, timeSec);
      gl.uniform2f(uniforms.u_res, canvas.width, canvas.height);
      gl.uniform1f(uniforms.u_wave, params.wave);
      gl.uniform1f(uniforms.u_jitter, params.jitter);
      gl.uniform1f(uniforms.u_crease, params.crease);
      gl.uniform1f(uniforms.u_switching, params.switching);
      gl.uniform1f(uniforms.u_switchingHeight, params.switchingHeight);
      gl.uniform1f(uniforms.u_aberration, params.aberration);
      gl.uniform1f(uniforms.u_chromaNoise, params.chromaNoise);
      gl.uniform1f(uniforms.u_grain, params.grain);
      gl.uniform1f(uniforms.u_scanlines, params.scanlines);
      gl.uniform1f(uniforms.u_vignette, params.vignette);
      gl.uniform1f(uniforms.u_barrel, params.barrel);
      gl.uniform1f(uniforms.u_saturation, params.saturation);
      gl.uniform1f(uniforms.u_exposure, params.exposure);
      gl.uniform1f(uniforms.u_compression, params.compression);
    }

    function drawFrame(timeSec) {
      if (!hasImage || !enabled) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(uniforms.u_tex, 0);
      setUniformParams(timeSec);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    function loop(ts) {
      if (!enabled) return;
      if (!startTs) startTs = ts;
      var t = (ts - startTs) / 1000;
      if (!params.pauseAnim) {
        drawFrame(t);
      }
      rafId = requestAnimationFrame(loop);
    }

    function stopLoop() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      startTs = 0;
    }

    function requestDraw(force) {
      if (!enabled || !hasImage) return;
      if (params.pauseAnim || force) {
        drawFrame((performance.now() - (startTs || performance.now())) / 1000);
      }
    }

    function syncVisibility() {
      if (enabled && hasImage) {
        canvas.style.display = '';
        imgEl.style.visibility = 'hidden';
        imgEl.style.position = 'absolute';
        imgEl.style.width = '0';
        imgEl.style.height = '0';
        imgEl.style.overflow = 'hidden';
      } else {
        canvas.style.display = 'none';
        imgEl.style.visibility = '';
        imgEl.style.position = '';
        imgEl.style.width = '';
        imgEl.style.height = '';
        imgEl.style.overflow = '';
      }
    }

    function setEnabled(on) {
      enabled = !!on;
      panel.className = 'vhs-panel' + (enabled ? ' vhs-panel-on' : '');
      panel.setAttribute('aria-hidden', enabled ? 'false' : 'true');
      syncVisibility();
      if (enabled) {
        if (hasImage) {
          stopLoop();
          rafId = requestAnimationFrame(loop);
        }
      } else {
        stopLoop();
      }
      // notifyState 可能尚未定义（初始化早期）；导出 UI 同步放在末尾首次调用
      if (typeof notifyState === 'function') notifyState();
    }

    // —— UI ——
    var panel = document.createElement('div');
    panel.className = 'vhs-panel';
    panel.setAttribute('aria-hidden', 'true');

    var enableRow = document.createElement('div');
    enableRow.className = 'vhs-enable-row';
    var enableLabel = document.createElement('label');
    var enableCb = document.createElement('input');
    enableCb.type = 'checkbox';
    enableCb.id = 'vhs-enable';
    enableCb.checked = false;
    enableLabel.appendChild(enableCb);
    enableLabel.appendChild(document.createTextNode(' 启用 HEISEI-VHS'));
    enableRow.appendChild(enableLabel);
    panel.appendChild(enableRow);

    var body = document.createElement('div');
    body.className = 'vhs-panel-body';
    var hint = document.createElement('div');
    hint.className = 'vhs-hint';
    hint.textContent = '本地 WebGL 劣化预览；不上传图片。调节滑杆即时生效。';
    body.appendChild(hint);

    var controlsWrap = document.createElement('div');
    controlsWrap.className = 'vhs-controls';
    PARAM_META.forEach(function (meta) {
      var row = document.createElement('div');
      row.className = 'vhs-ctrl-row';
      row.title = meta.title;
      var name = document.createElement('span');
      name.className = 'vhs-ctrl-name';
      name.textContent = meta.label;
      var range = document.createElement('input');
      range.type = 'range';
      range.min = String(meta.min);
      range.max = String(meta.max);
      range.step = String(meta.step);
      range.value = String(params[meta.key]);
      range.setAttribute('data-vhs-key', meta.key);
      var num = document.createElement('input');
      // text + inputmode：避免 type=number 在部分浏览器里输入小数点被吃掉
      num.type = 'text';
      num.inputMode = 'decimal';
      num.autocomplete = 'off';
      num.spellcheck = false;
      num.setAttribute('data-vhs-min', String(meta.min));
      num.setAttribute('data-vhs-max', String(meta.max));
      num.setAttribute('data-vhs-step', String(meta.step));
      num.value = String(params[meta.key]);
      num.setAttribute('data-vhs-key', meta.key);
      // syncNum=false：输入过程中不回写 num，否则 "0." / "1.0" 会被 parseFloat 清掉小数点
      function applyValue(v, syncNum) {
        var n = parseFloat(v);
        if (isNaN(n)) return false;
        n = Math.min(meta.max, Math.max(meta.min, n));
        params[meta.key] = n;
        range.value = String(n);
        if (syncNum) num.value = String(n);
        requestDraw(true);
        return true;
      }
      function isDecimalDraft(v) {
        return v === '' || v === '-' || v === '.' || v === '-.' || /^-?\d+\.$/.test(v);
      }
      range.addEventListener('input', function () { applyValue(range.value, true); });
      num.addEventListener('input', function () {
        var v = num.value;
        if (isDecimalDraft(v)) return;
        applyValue(v, false);
      });
      num.addEventListener('change', function () {
        if (!applyValue(num.value, true)) {
          num.value = String(params[meta.key]);
        }
      });
      row.appendChild(name);
      row.appendChild(range);
      row.appendChild(num);
      controlsWrap.appendChild(row);
    });
    body.appendChild(controlsWrap);

    var tools = document.createElement('div');
    tools.className = 'vhs-tools';
    var pauseLabel = document.createElement('label');
    var pauseCb = document.createElement('input');
    pauseCb.type = 'checkbox';
    pauseCb.id = 'vhs-pause';
    pauseLabel.appendChild(pauseCb);
    pauseLabel.appendChild(document.createTextNode(' 暂停动画'));
    pauseCb.addEventListener('change', function () {
      params.pauseAnim = !!pauseCb.checked;
      if (!params.pauseAnim && enabled) {
        stopLoop();
        rafId = requestAnimationFrame(loop);
      } else {
        requestDraw(true);
      }
      notifyState();
    });
    var resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.textContent = '重置默认';
    resetBtn.addEventListener('click', function () {
      params = cloneDefaults();
      pauseCb.checked = false;
      var ranges = body.querySelectorAll('input[data-vhs-key]');
      for (var i = 0; i < ranges.length; i++) {
        var el = ranges[i];
        var key = el.getAttribute('data-vhs-key');
        if (key && Object.prototype.hasOwnProperty.call(params, key)) {
          el.value = String(params[key]);
        }
      }
      requestDraw(true);
      notifyState();
    });
    var exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.textContent = '导出 VHS 图片';
    exportBtn.addEventListener('click', function () {
      exportPng();
    });
    var exportGifBtn = document.createElement('button');
    exportGifBtn.type = 'button';
    exportGifBtn.textContent = '导出 VHS 动图 (GIF)';
    exportGifBtn.style.display = 'none';
    exportGifBtn.addEventListener('click', function () {
      exportGif();
    });
    tools.appendChild(pauseLabel);
    tools.appendChild(resetBtn);
    tools.appendChild(exportBtn);
    tools.appendChild(exportGifBtn);
    body.appendChild(tools);
    panel.appendChild(body);
    opts.panelHost.appendChild(panel);

    function notifyState() {
      syncGifButtonVisibility();
      if (typeof opts.onStateChange === 'function') {
        try {
          opts.onStateChange({
            enabled: enabled,
            paused: !!params.pauseAnim,
            hasImage: hasImage,
            canExportGif: canExportGif()
          });
        } catch (e) { /* ignore */ }
      }
    }

    function canExportGif() {
      return !!(enabled && hasImage && !params.pauseAnim && imgEl.naturalWidth);
    }

    function syncGifButtonVisibility() {
      exportGifBtn.style.display = canExportGif() ? '' : 'none';
    }

    enableCb.addEventListener('change', function () {
      setEnabled(enableCb.checked);
      notifyState();
    });

    function exportPng() {
      if (!hasImage || !imgEl.naturalWidth) {
        alert('请先选择图片，再导出 VHS 效果。');
        return;
      }
      if (!enabled) {
        alert('请先启用 HEISEI-VHS。');
        return;
      }
      var max = maxTexSize();
      var w = sourceW || imgEl.naturalWidth;
      var h = sourceH || imgEl.naturalHeight;
      var scale = 1;
      if (w > max || h > max) scale = Math.min(max / w, max / h);
      var ow = canvas.width;
      var oh = canvas.height;
      canvas.width = Math.max(1, Math.floor(w * scale));
      canvas.height = Math.max(1, Math.floor(h * scale));
      gl.bindTexture(gl.TEXTURE_2D, texture);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgEl);
      } catch (e) {
        canvas.width = ow;
        canvas.height = oh;
        alert('导出失败：无法读取图片纹理。');
        return;
      }
      drawFrame((performance.now() - (startTs || performance.now())) / 1000);
      try {
        var url = canvas.toDataURL('image/png');
        var a = document.createElement('a');
        a.href = url;
        a.download = 'heisei-vhs.png';
        a.click();
      } catch (err) {
        alert('导出失败：' + (err && err.message ? err.message : 'unknown'));
      }
      // 恢复预览尺寸
      canvas.width = ow;
      canvas.height = oh;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgEl);
      } catch (e2) { /* ignore */ }
      requestDraw(true);
    }

    function prepareFullResCanvas() {
      var max = maxTexSize();
      var w = sourceW || imgEl.naturalWidth;
      var h = sourceH || imgEl.naturalHeight;
      var scale = 1;
      if (w > max || h > max) scale = Math.min(max / w, max / h);
      // GIF 再限一边，避免动图过大
      var gifMax = 720;
      var fw = Math.max(1, Math.floor(w * scale));
      var fh = Math.max(1, Math.floor(h * scale));
      if (fw > gifMax || fh > gifMax) {
        var s2 = Math.min(gifMax / fw, gifMax / fh);
        fw = Math.max(1, Math.floor(fw * s2));
        fh = Math.max(1, Math.floor(fh * s2));
      }
      var ow = canvas.width;
      var oh = canvas.height;
      canvas.width = fw;
      canvas.height = fh;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgEl);
      return { ow: ow, oh: oh, width: fw, height: fh };
    }

    function restorePreviewCanvas(saved) {
      canvas.width = saved.ow;
      canvas.height = saved.oh;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgEl);
      } catch (e2) { /* ignore */ }
      requestDraw(true);
    }

    function downloadBlob(blob, filename) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }

    function yieldTick() {
      return new Promise(function (resolve) {
        setTimeout(resolve, 0);
      });
    }

    function exportGif() {
      if (!global.JwGif || typeof global.JwGif.encodeFromCanvases !== 'function') {
        alert('GIF 编码器未加载，请刷新页面后重试。');
        return;
      }
      if (!hasImage || !imgEl.naturalWidth) {
        alert('请先选择图片，再导出 VHS 动图。');
        return;
      }
      if (!enabled) {
        alert('请先启用 HEISEI-VHS。');
        return;
      }
      if (params.pauseAnim) {
        alert('请取消勾选「暂停动画」后再导出 GIF 动图。');
        return;
      }

      var frameCount = 24;
      var durationSec = 2;
      var delayMs = 100;
      var saved = null;
      var wasEnabled = enabled;
      exportGifBtn.disabled = true;
      exportGifBtn.textContent = '导出中…';
      stopLoop();

      Promise.resolve().then(function () {
        saved = prepareFullResCanvas();
        var frames = [];
        var i = 0;
        function next() {
          if (i >= frameCount) {
            return frames;
          }
          var t = (i / frameCount) * durationSec;
          drawFrame(t);
          var snap = document.createElement('canvas');
          snap.width = canvas.width;
          snap.height = canvas.height;
          snap.getContext('2d').drawImage(canvas, 0, 0);
          frames.push(snap);
          i += 1;
          return yieldTick().then(next);
        }
        return next();
      }).then(function (frames) {
        var blob = global.JwGif.encodeFromCanvases(frames, delayMs);
        downloadBlob(blob, 'heisei-vhs.gif');
      }).catch(function (err) {
        console.error(err);
        alert('导出 GIF 失败：' + (err && err.message ? err.message : 'unknown'));
      }).then(function () {
        if (saved) restorePreviewCanvas(saved);
        if (wasEnabled && !params.pauseAnim && hasImage) {
          rafId = requestAnimationFrame(loop);
        }
        exportGifBtn.disabled = false;
        exportGifBtn.textContent = '导出 VHS 动图 (GIF)';
        notifyState();
      });
    }

    function renderAtTime(timeSec) {
      if (!enabled || !hasImage) return false;
      drawFrame(timeSec);
      return true;
    }

    function beginCapture() {
      stopLoop();
    }

    function endCapture() {
      if (enabled && hasImage && !params.pauseAnim) {
        stopLoop();
        rafId = requestAnimationFrame(loop);
      } else {
        requestDraw(true);
      }
    }

    function onImgReady() {
      uploadImage();
      notifyState();
    }

    imgEl.addEventListener('load', onImgReady);
    if (imgEl.complete && imgEl.naturalWidth) {
      onImgReady();
    }

    // 透明度滑杆同时作用于 canvas
    var opacitySlider = document.getElementById('slider');
    var opacityInput = document.getElementById('input_num');
    function syncOpacity() {
      var v = opacitySlider ? opacitySlider.value : (imgEl.style.opacity || '1');
      canvas.style.opacity = v;
    }
    if (opacitySlider) opacitySlider.addEventListener('input', syncOpacity);
    if (opacityInput) opacityInput.addEventListener('input', syncOpacity);
    syncOpacity();

    notifyState();

    return {
      setEnabled: setEnabled,
      isEnabled: function () { return enabled; },
      isPaused: function () { return !!params.pauseAnim; },
      canExportGif: canExportGif,
      renderAtTime: renderAtTime,
      beginCapture: beginCapture,
      endCapture: endCapture,
      redraw: function () { requestDraw(true); },
      destroy: function () {
        stopLoop();
        imgEl.removeEventListener('load', onImgReady);
        if (panel.parentNode) panel.parentNode.removeChild(panel);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  global.HeiseiVHS = {
    mount: mount,
    DEFAULTS: DEFAULTS
  };
})(window);
