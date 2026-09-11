document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.getElementById('navToggle');
  var links = document.getElementById('navLinks');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      links.classList.toggle('open');
    });
  }

  // Generate a simple skyline silhouette for any .buildings container
  // (used behind the homepage hero and the shorter interior page headers).
  document.querySelectorAll('.buildings').forEach(function (wrap) {
    var n = wrap.dataset.count ? parseInt(wrap.dataset.count, 10) : 26;
    for (var i = 0; i < n; i++) {
      var b = document.createElement('div');
      b.className = 'b';
      var w = 18 + Math.random() * 34;
      var h = 40 + Math.random() * (wrap.clientHeight || 180);
      b.style.width = w + 'px';
      b.style.height = Math.min(h, wrap.clientHeight || 230) + 'px';
      wrap.appendChild(b);
    }
  });
});
