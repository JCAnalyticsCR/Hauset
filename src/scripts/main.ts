import { initHomeLab } from './home-lab';
import { initSolutions } from './solutions';
import { initQuoteWizard } from './quote-wizard';
import { initHomeExperienceDialog } from './home-experience-dialog';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
// The page stays readable when JavaScript or motion is unavailable.
if ('IntersectionObserver' in window && !reducedMotion.matches) {
  document.documentElement.classList.add('motion-ready');
  const reveals = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          reveals.unobserve(entry.target);
        }
    },
    { threshold: 0.08, rootMargin: '0px 0px -25px 0px' },
  );
  document
    .querySelectorAll<HTMLElement>('.reveal')
    .forEach((element, index) => {
      element.style.transitionDelay = `${Math.min(index % 2, 1) * 65}ms`;
      if (element.getBoundingClientRect().top < innerHeight)
        element.classList.add('is-visible');
      else reveals.observe(element);
    });
}
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches)
    document.documentElement.classList.remove('motion-ready');
});

const menu = document.querySelector<HTMLButtonElement>('.menu-toggle');
const navigation = document.querySelector<HTMLElement>('#navigation');
const closeMenu = () => {
  menu?.setAttribute('aria-expanded', 'false');
  menu?.setAttribute('aria-label', 'Abrir menú');
  navigation?.classList.remove('is-open');
};
menu?.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  navigation?.classList.toggle('is-open', open);
});
navigation
  ?.querySelectorAll('a')
  .forEach((link) => link.addEventListener('click', closeMenu));
document.addEventListener('click', (event) => {
  if (
    event.target instanceof Node &&
    !menu?.contains(event.target) &&
    !navigation?.contains(event.target)
  )
    closeMenu();
});
document.addEventListener('keydown', (event) => {
  if (
    event.key === 'Escape' &&
    menu?.getAttribute('aria-expanded') === 'true'
  ) {
    closeMenu();
    menu.focus();
  }
});

const experience = document.querySelector<HTMLElement>('.experience');
const heroConsult = document.querySelector<HTMLAnchorElement>(
  '[data-quote-entry="hero"]',
);
initHomeExperienceDialog();
initHomeLab();
initSolutions();
initQuoteWizard(closeMenu);

const mobileViewport = matchMedia('(max-width: 650px)');
const disclosures = [
  ...document.querySelectorAll<HTMLDetailsElement>('[data-mobile-disclosure]'),
];
const syncDisclosures = () => {
  let target: HTMLElement | null = null;
  try {
    target = document.getElementById(
      decodeURIComponent(location.hash.slice(1)),
    );
  } catch {
    /* An invalid fragment cannot identify a section. */
  }
  disclosures.forEach((details) => {
    details.open =
      !mobileViewport.matches || Boolean(target && details.contains(target));
  });
};
syncDisclosures();
mobileViewport.addEventListener('change', () => {
  syncDisclosures();
  closeMenu();
});
// A compact table of contents makes the mobile journey finite and skippable.
const chapterLinks = [
  ...document.querySelectorAll<HTMLAnchorElement>('.chapter-nav a'),
];
if ('IntersectionObserver' in window) {
  const chapterVisibility = new Map<Element, boolean>();
  const chapterIds = new Map<Element, string>();
  const chapters = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) =>
        chapterVisibility.set(entry.target, entry.isIntersecting),
      );
      const visible = [...chapterVisibility]
        .filter(([, intersecting]) => intersecting)
        .map(([element]) => element)
        .sort(
          (a, b) =>
            a.getBoundingClientRect().top - b.getBoundingClientRect().top,
        );
      const chapter = visible[0] ? chapterIds.get(visible[0]) : undefined;
      if (chapter)
        chapterLinks.forEach((link) => {
          if (link.hash === `#${chapter}`)
            link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
    },
    { rootMargin: '-15% 0px -60% 0px', threshold: 0 },
  );
  chapterLinks.forEach((link) => {
    const chapter = document.querySelector(link.hash);
    if (chapter) {
      chapterIds.set(chapter, chapter.id);
      chapters.observe(chapter);
    }
  });
  const teamStory = document.querySelector('.story-drawer');
  if (teamStory) {
    chapterIds.set(teamStory, 'equipo');
    chapters.observe(teamStory);
  }
}

const stickyConsult = document.querySelector<HTMLElement>('.consult-fab');
const quoteSection = document.querySelector('#tu-proyecto');
if (
  'IntersectionObserver' in window &&
  stickyConsult &&
  heroConsult &&
  quoteSection
) {
  let primaryVisible = true;
  let quoteVisible = false;
  const stickyObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.target === heroConsult) primaryVisible = entry.isIntersecting;
      if (entry.target === quoteSection) quoteVisible = entry.isIntersecting;
    });
    const visible = !primaryVisible && !quoteVisible;
    stickyConsult.classList.toggle('is-visible', visible);
    stickyConsult.setAttribute('aria-hidden', String(!visible));
    stickyConsult.tabIndex = visible ? 0 : -1;
  });
  stickyObserver.observe(heroConsult);
  stickyObserver.observe(quoteSection);
} else if (stickyConsult) {
  stickyConsult.classList.add('is-visible');
  stickyConsult.setAttribute('aria-hidden', 'false');
  stickyConsult.tabIndex = 0;
}

const dialog = document.querySelector<HTMLDialogElement>('#story-dialog');
const video = document.querySelector<HTMLVideoElement>('#story-video');
document.querySelectorAll('.video-open').forEach((button) =>
  button.addEventListener('click', () => {
    if (!dialog || !video) return;
    if (typeof dialog.showModal !== 'function') {
      window.open(
        video.querySelector('source')?.src,
        '_blank',
        'noopener,noreferrer',
      );
      return;
    }
    dialog.showModal();
    void video.play().catch(() => {
      /* Native controls remain available. */
    });
  }),
);
document
  .querySelector('.video-close')
  ?.addEventListener('click', () => dialog?.close());
dialog?.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});
dialog?.addEventListener('close', () => {
  video?.pause();
});

const progress = document.querySelector<HTMLElement>(
  '.reading-progress > span',
);
let scrollQueued = false;
const updateScroll = () => {
  const distance = document.documentElement.scrollHeight - innerHeight;
  progress?.style.setProperty(
    'transform',
    `scaleX(${distance > 0 ? scrollY / distance : 0})`,
  );
  if (!reducedMotion.matches && innerWidth > 650)
    experience?.style.setProperty(
      '--hero-travel',
      `${Math.min(scrollY * 0.12, 65)}px`,
    );
  scrollQueued = false;
};
addEventListener(
  'scroll',
  () => {
    if (!scrollQueued) {
      scrollQueued = true;
      requestAnimationFrame(updateScroll);
    }
  },
  { passive: true },
);
addEventListener('resize', updateScroll, { passive: true });
updateScroll();
