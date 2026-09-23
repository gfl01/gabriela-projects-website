// === Scroll-based header styling ===
const header = document.getElementById('header');
const headerLogo = header.querySelector('.logo img');
const isHome = document.body.classList.contains('home');
const heroSection = document.querySelector('.hero') || document.querySelector('.page-hero');

function isHeaderOverHero() {
  if (!heroSection) return false;
  var heroRect = heroSection.getBoundingClientRect();
  var headerHeight = header.offsetHeight;
  // Header overlaps hero when hero top is above header bottom and hero bottom is below header top
  return heroRect.top < headerHeight && heroRect.bottom > 0;
}

function updateHeader() {
  var overHero = isHeaderOverHero();

  if (window.scrollY > 80) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }

  if (!isHome && headerLogo) {
    if (overHero && !header.classList.contains('scrolled')) {
      headerLogo.src = 'images/common/logo-white.svg';
    } else {
      headerLogo.src = 'images/common/logo.svg';
    }
  }
}
window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();

// === Mobile nav toggle (slide-in side panel) ===
const hamburger = document.getElementById('hamburger');
const nav = document.getElementById('nav');

// Create backdrop element for mobile nav
const navBackdrop = document.createElement('div');
navBackdrop.className = 'nav-backdrop';
document.body.appendChild(navBackdrop);

function isMobile() {
  return window.innerWidth <= 768;
}

function closeNav() {
  hamburger.classList.remove('open');
  nav.classList.remove('open');
  navBackdrop.classList.remove('open');
  document.body.style.overflow = '';
  // Move nav back into header after transition
  setTimeout(function() {
    if (!nav.classList.contains('open') && nav.parentElement !== header) {
      header.appendChild(nav);
    }
  }, 400);
}

function openNav() {
  // Move nav to body to escape header's backdrop-filter containing block
  if (isMobile() && nav.parentElement !== document.body) {
    document.body.appendChild(nav);
  }
  // Small delay to let DOM update before triggering transition
  requestAnimationFrame(function() {
    hamburger.classList.add('open');
    nav.classList.add('open');
    navBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';
  });
}

if (hamburger) {
  hamburger.addEventListener('click', function() {
    if (nav.classList.contains('open')) {
      closeNav();
    } else {
      openNav();
    }
  });

  // Close nav when backdrop is clicked
  navBackdrop.addEventListener('click', closeNav);

  // Close nav when a link is clicked
  nav.querySelectorAll('a').forEach(function(link) {
    link.addEventListener('click', closeNav);
  });

  // If window is resized to desktop while nav is open, close it and move nav back
  window.addEventListener('resize', function() {
    if (!isMobile() && nav.classList.contains('open')) {
      closeNav();
    }
    if (!isMobile() && nav.parentElement !== header) {
      header.appendChild(nav);
    }
  });
}

// === Scroll reveal animations ===
const revealElements = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, {
  // A percentage threshold can never be met by an element taller than
  // 1 / threshold viewports (e.g. a long before/after list), which would
  // leave it stuck at opacity 0. Trigger on first contact instead and use
  // the bottom margin to hold the reveal until the element is properly in view.
  threshold: 0,
  rootMargin: '0px 0px -120px 0px'
});

revealElements.forEach(el => revealObserver.observe(el));

// === Inner page header (always scrolled style) ===
if (!document.querySelector('.hero') && !document.querySelector('.page-hero')) {
  header.classList.add('scrolled');
}

// === Before / After sliders ===
// Lives here rather than inline on the portfolio pages so there is one copy to
// maintain. Pages without sliders simply match nothing.
(function () {
  const sliders = document.querySelectorAll('.ba-slider');
  if (!sliders.length) return;

  const MIN = 2;
  const MAX = 98;
  let active = null; // slider currently being dragged

  sliders.forEach(function (slider) {
    const beforeImg = slider.querySelector('.ba-img-before');
    const afterImg = slider.querySelector('.ba-img-after');
    const handle = slider.querySelector('.ba-handle');
    if (!beforeImg || !handle) return;

    // The control only works with JS, so the a11y contract is set up here
    // rather than in the markup.
    const subject = (afterImg && afterImg.getAttribute('alt') || 'Before and after')
      .replace(/\s+after$/i, '')
      .trim();
    slider.setAttribute('role', 'slider');
    slider.setAttribute('tabindex', '0');
    slider.setAttribute('aria-label', subject + ', before and after comparison');
    slider.setAttribute('aria-orientation', 'horizontal');
    slider.setAttribute('aria-valuemin', String(MIN));
    slider.setAttribute('aria-valuemax', String(MAX));

    function setPosition(pos) {
      pos = Math.max(MIN, Math.min(MAX, pos));
      beforeImg.style.clipPath = 'inset(0 ' + (100 - pos) + '% 0 0)';
      handle.style.left = pos + '%';
      slider.dataset.position = pos;
      slider.setAttribute('aria-valuenow', String(Math.round(pos)));
      slider.setAttribute('aria-valuetext',
        Math.round(pos) + '% before, ' + Math.round(100 - pos) + '% after');
    }

    function setFromX(x) {
      const rect = slider.getBoundingClientRect();
      setPosition(((x - rect.left) / rect.width) * 100);
    }

    slider.setPosition = setPosition;
    slider.setFromX = setFromX;
    setPosition(parseFloat(slider.dataset.position) || 50);

    slider.addEventListener('mousedown', function (e) {
      e.preventDefault();
      active = slider;
      slider.focus(); // preventDefault above would otherwise suppress focus
      setFromX(e.clientX);
    });

    slider.addEventListener('touchstart', function (e) {
      active = slider;
      setFromX(e.touches[0].clientX);
    }, { passive: true });

    slider.addEventListener('touchmove', function (e) {
      if (active !== slider) return;
      e.preventDefault();
      setFromX(e.touches[0].clientX);
    }, { passive: false });

    slider.addEventListener('touchend', function () { active = null; });

    slider.addEventListener('keydown', function (e) {
      const current = parseFloat(slider.dataset.position) || 50;
      const step = e.shiftKey ? 10 : 2;
      let next;

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowDown':  next = current - step; break;
        case 'ArrowRight':
        case 'ArrowUp':    next = current + step; break;
        case 'PageDown':   next = current - 20; break;
        case 'PageUp':     next = current + 20; break;
        case 'Home':       next = MIN; break;
        case 'End':        next = MAX; break;
        default: return;
      }

      e.preventDefault();
      setPosition(next);
    });
  });

  // One pair of document listeners for every slider, rather than one pair each.
  document.addEventListener('mousemove', function (e) {
    if (!active) return;
    e.preventDefault();
    active.setFromX(e.clientX);
  });

  document.addEventListener('mouseup', function () { active = null; });
})();

// === Deep links to a single project (e.g. /portfolio#park-avenue) ===
// The portfolio page is long and image-heavy, so the browser's own jump to an
// anchor can fire before layout has settled and end up at the top of the page.
// Re-run the jump once everything has loaded. CSS scroll-margin-top keeps the
// heading clear of the fixed header.
(function () {
  function jumpToHash(instant) {
    if (!location.hash) return;
    var target = null;
    try {
      target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    } catch (e) {
      return;
    }
    if (!target) return;
    target.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'start' });
  }

  if (location.hash) {
    // 'load' waits for images, so the target's final position is known.
    // Deliberately not requestAnimationFrame: it never fires while the tab is
    // hidden, so a link opened in a background tab would stay at the top.
    window.addEventListener('load', function () {
      jumpToHash(true);
      setTimeout(function () { jumpToHash(true); }, 80);
    });
  }

  // Following a #link while already on the page.
  window.addEventListener('hashchange', function () { jumpToHash(false); });
})();
