'use strict';

(() => {
  const ray = document.querySelector('.load-ray');
  const finishLoad = () => ray?.classList.add('ready');
  if (document.readyState === 'complete') finishLoad();
  else window.addEventListener('load', finishLoad, {once:true});

  function arrive(fromHistory) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const fromSite = document.referrer && new URL(document.referrer).origin === location.origin;
    if (!fromSite && !fromHistory) return;
    document.body.classList.add('arriving');
    setTimeout(() => document.body.classList.remove('arriving'), 450);
  }
  arrive(performance.getEntriesByType('navigation')[0]?.type === 'back_forward');
  window.addEventListener('pageshow', event => { if (event.persisted) arrive(true); });

  if (!window.gsap) return;
  const preferences = gsap.matchMedia();
  preferences.add('(prefers-reduced-motion: no-preference)', context => {
    const sign = document.querySelector('.solar-sign');
    const progress = {t:0};
    const sun = sign.querySelector('.orbit-sun');
    const headline = gsap.timeline({defaults:{ease:'power2.out'}});
    headline.from(sign.querySelector('span'), {y:6, opacity:0, duration:.45}, 0)
      .to(progress, {t:.5, duration:.85, onUpdate(){
        const t = progress.t;
        sun.style.transform = 'translate(' + (6+40*t) + 'px,' + (20-66*t*(1-t)) + 'px)';
      }}, 0)
      .from(document.querySelector('h1'), {y:14, opacity:.3, duration:.6}, .1);

    if (!('IntersectionObserver' in window)) return;
    context.add('reveal', element => {
      const targets = element.matches('.solutions,.process ol') ? [...element.children] : [element];
      gsap.from(targets, {y:18,opacity:.35,duration:.55,stagger:.085,ease:'power2.out',clearProps:'transform,opacity'});
    });
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        context.reveal(entry.target);
      });
    }, {rootMargin:'0px 0px -3% 0px'});
    document.querySelectorAll('.solutions,.process ol,.experience-copy,.studio-preview,.quote-photo,.section-heading,.analysis-card,.quote-start,.guide>h2').forEach(el=>observer.observe(el));
    return () => {observer.disconnect(); sun.style.removeProperty('transform');};
  });
})();
