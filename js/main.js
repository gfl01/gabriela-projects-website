// === Scroll-based header styling ===
const header = document.getElementById('header');
const headerLogo = header.querySelector('.logo img');
const isHome = document.body.classList.contains('home');

function updateHeader() {
  if (window.scrollY > 80) {
    header.classList.add('scrolled');
    if (!isHome && headerLogo) {
      headerLogo.src = 'images/common/logo.svg';
    }
  } else {
    header.classList.remove('scrolled');
    if (!isHome && headerLogo) {
      headerLogo.src = 'images/common/logo-white.svg';
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
  threshold: 0.15,
  rootMargin: '0px 0px -50px 0px'
});

revealElements.forEach(el => revealObserver.observe(el));

// === Inner page header (always scrolled style) ===
if (!document.querySelector('.hero')) {
  header.classList.add('scrolled');
}
