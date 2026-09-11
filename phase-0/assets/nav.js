/* nav.js — 课程页左侧小节导航（kbar 共享层）
 * 自动从 h2[id] 生成本课目录，固定在左留白处（≥1240px 显示，窄屏隐藏，css 在 course.css）。
 * 滚动时高亮当前小节；点击平滑滚动。无 h2[id] 的页面静默退出；零依赖。 */
(function () {
  if (typeof document === 'undefined') return;
  var all = document.querySelectorAll('h2[id]');
  var secs = [], seen = {};
  for (var i = 0; i < all.length; i++) {
    if (!seen[all[i].id]) { seen[all[i].id] = 1; secs.push(all[i]); }
  }
  if (secs.length < 2) return;

  var html = ['<div class="lt-title">本课导航</div>'];
  secs.forEach(function (h) {
    var no = h.querySelector('.no');
    var title = h.textContent;
    if (no) title = title.replace(no.textContent, '');
    title = title.replace(/≈\s*\d+\s*min/, '').trim();
    html.push('<a href="#' + h.id + '"><span class="lt-no">' + (no ? no.textContent.trim() : '·') + '</span>' + title + '</a>');
  });
  var nav = document.createElement('nav');
  nav.className = 'lesson-toc';
  nav.setAttribute('aria-label', '本课导航');
  nav.innerHTML = html.join('');
  document.body.appendChild(nav);

  var links = nav.querySelectorAll('a');
  var ticking = false;
  function setActive() {
    ticking = false;
    var cur = -1;
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].getBoundingClientRect().top <= 100) cur = i;
    }
    for (var j = 0; j < links.length; j++) {
      links[j].classList.toggle('on', j === cur);
    }
    // 当前项滚进可视区（目录自身可滚动时）
    var on = nav.querySelector('a.on');
    if (on && nav.scrollHeight > nav.clientHeight) {
      var top = on.offsetTop, bottom = top + on.offsetHeight;
      if (top < nav.scrollTop || bottom > nav.scrollTop + nav.clientHeight) {
        nav.scrollTop = top - nav.clientHeight / 2 + on.offsetHeight / 2;
      }
    }
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(setActive); }
  }, { passive: true });
  nav.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a) return;
    var t = document.getElementById(a.getAttribute('href').slice(1));
    if (!t) return;
    e.preventDefault();
    t.scrollIntoView({ behavior: 'smooth' });
    history.replaceState(null, '', a.getAttribute('href'));
  });
  setActive();
})();
