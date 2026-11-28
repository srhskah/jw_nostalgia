/**
 * 对话框导出共用：图片清洗、下载、VHS 挂载、对话框 GIF 绑定
 * 供 Aero / Classic / MacOS9 / MacOSX 复用；主题专属 chrome 烘焙仍留在各页。
 */
(function (global) {
  'use strict';

  var LAYOUT_WIDTH = 380;

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename || 'download.bin';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function downloadCanvasPng(canvas, filename) {
    function trigger(href) {
      var link = document.createElement('a');
      link.href = href;
      link.download = filename || 'exported-image.png';
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    if (canvas.toBlob) {
      canvas.toBlob(function (blob) {
        if (!blob) {
          trigger(canvas.toDataURL('image/png'));
          return;
        }
        var url = URL.createObjectURL(blob);
        trigger(url);
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      }, 'image/png');
    } else {
      trigger(canvas.toDataURL('image/png'));
    }
  }

  function imgSrcToDataURL(img) {
    var src = img.getAttribute('src') || '';
    if (!src || src.indexOf('data:') === 0) {
      return Promise.resolve();
    }
    return fetch(src).then(function (res) {
      if (!res.ok) throw new Error('fetch image failed: ' + res.status);
      return res.blob();
    }).then(function (blob) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(reader.result); };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }).then(function (dataUrl) {
      return new Promise(function (resolve, reject) {
        img.onload = function () { resolve(); };
        img.onerror = reject;
        img.removeAttribute('crossorigin');
        img.src = dataUrl;
      });
    }).catch(function (err) {
      console.warn('导出前转换图片失败:', src, err);
    });
  }

  function ensureExportImagesClean(root) {
    var imgs = root.querySelectorAll('img');
    var tasks = [];
    for (var i = 0; i < imgs.length; i++) {
      tasks.push(imgSrcToDataURL(imgs[i]));
    }
    return Promise.all(tasks);
  }

  function syncDialogGifButton(vhsApi, buttonId) {
    var btn = document.getElementById(buttonId || 'exportGifButton');
    if (!btn) return;
    var show = !!(vhsApi && vhsApi.canExportGif && vhsApi.canExportGif());
    btn.style.display = show ? '' : 'none';
  }

  function mountVhs(opts) {
    opts = opts || {};
    var gifButtonId = opts.gifButtonId || 'exportGifButton';
    var api = null;
    function sync() {
      syncDialogGifButton(api, gifButtonId);
    }
    var userOnState = opts.onStateChange;
    var mountOpts = {};
    for (var k in opts) {
      if (Object.prototype.hasOwnProperty.call(opts, k) && k !== 'gifButtonId' && k !== 'onStateChange') {
        mountOpts[k] = opts[k];
      }
    }
    mountOpts.onStateChange = function (state) {
      sync();
      if (typeof userOnState === 'function') userOnState(state);
    };
    if (global.HeiseiVHS && typeof global.HeiseiVHS.mount === 'function') {
      api = global.HeiseiVHS.mount(mountOpts);
      sync();
    }
    return api;
  }

  /**
   * 绑定「导出对话框为动图 (GIF)」
   * opts: {
   *   buttonId, elementId, getVhsApi, applyChrome, filename,
   *   scale, useLayoutWidth, frameCount, durationSec, delayMs,
   *   cleanImages (default true)
   * }
   */
  function bindDialogGifExport(opts) {
    opts = opts || {};
    var buttonId = opts.buttonId || 'exportGifButton';
    var btn = document.getElementById(buttonId);
    if (!btn) return;

    var frameCount = opts.frameCount || 16;
    var durationSec = opts.durationSec || 2;
    var delayMs = opts.delayMs || 120;
    var scale = opts.scale == null ? 2 : opts.scale;
    var cleanImages = opts.cleanImages !== false;
    var labelIdle = btn.textContent || '导出对话框为动图 (GIF)';

    btn.addEventListener('click', function () {
      var vhsApi = typeof opts.getVhsApi === 'function' ? opts.getVhsApi() : null;
      if (!vhsApi || !vhsApi.canExportGif || !vhsApi.canExportGif()) {
        alert('请启用 HEISEI-VHS、选择图片，并取消「暂停动画」后再导出 GIF。');
        syncDialogGifButton(vhsApi, buttonId);
        return;
      }
      if (!global.JwGif || typeof global.JwGif.encodeFromCanvases !== 'function') {
        alert('GIF 编码器未加载，请刷新页面后重试。');
        return;
      }
      if (typeof global.html2canvas !== 'function') {
        alert('html2canvas 未加载，请刷新页面后重试。');
        return;
      }

      var element = document.getElementById(opts.elementId);
      if (!element) {
        alert('未找到导出目标。');
        return;
      }

      var restoreChrome = null;
      var frames = [];
      btn.disabled = true;
      btn.textContent = '导出中…';

      var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
      fontsReady.then(function () {
        if (cleanImages) return ensureExportImagesClean(element);
      }).then(function () {
        vhsApi.beginCapture();
        if (typeof opts.applyChrome === 'function') {
          restoreChrome = opts.applyChrome(element);
        }
        element.offsetHeight;
        var i = 0;
        function captureNext() {
          if (i >= frameCount) return Promise.resolve(frames);
          vhsApi.renderAtTime((i / frameCount) * durationSec);
          element.offsetHeight;
          var h2cOpts = {
            useCORS: true,
            allowTaint: false,
            backgroundColor: null,
            scale: scale,
            scrollX: 0,
            scrollY: 0
          };
          if (opts.useLayoutWidth) {
            h2cOpts.windowWidth = LAYOUT_WIDTH;
            h2cOpts.windowHeight = Math.max(element.scrollHeight, element.offsetHeight);
          }
          return global.html2canvas(element, h2cOpts).then(function (canvas) {
            frames.push(canvas);
            i += 1;
            return new Promise(function (r) { setTimeout(r, 0); }).then(captureNext);
          });
        }
        return captureNext();
      }).then(function (captured) {
        if (restoreChrome) restoreChrome();
        restoreChrome = null;
        if (vhsApi) vhsApi.endCapture();
        var blob = global.JwGif.encodeFromCanvases(captured, delayMs);
        downloadBlob(blob, opts.filename || 'exported-dialog.gif');
      }).catch(function (err) {
        if (restoreChrome) restoreChrome();
        if (vhsApi) vhsApi.endCapture();
        console.error(err);
        alert('导出 GIF 失败：' + (err && err.message ? err.message : 'unknown'));
      }).then(function () {
        btn.disabled = false;
        btn.textContent = labelIdle;
        syncDialogGifButton(vhsApi, buttonId);
      });
    });
  }

  global.JwExport = {
    LAYOUT_WIDTH: LAYOUT_WIDTH,
    downloadBlob: downloadBlob,
    downloadCanvasPng: downloadCanvasPng,
    imgSrcToDataURL: imgSrcToDataURL,
    ensureExportImagesClean: ensureExportImagesClean,
    syncDialogGifButton: syncDialogGifButton,
    mountVhs: mountVhs,
    bindDialogGifExport: bindDialogGifExport
  };
})(typeof window !== 'undefined' ? window : this);
