// === Scroll-based header styling ===
const header = document.getElementById('header');
function updateHeader() {
  if (window.scrollY > 80) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
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

function closeNav() {
  hamburger.classList.remove('open');
  nav.classList.remove('open');
  navBackdrop.classList.remove('open');
  document.body.style.overflow = '';
}

function openNav() {
  hamburger.classList.add('open');
  nav.classList.add('open');
  navBackdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
}

if (hamburger) {
  hamburger.addEventListener('click', () => {
    if (nav.classList.contains('open')) {
      closeNav();
    } else {
      openNav();
    }
  });

  // Close nav when backdrop is clicked
  navBackdrop.addEventListener('click', closeNav);

  // Close nav when a link is clicked
  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeNav);
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
