'use strict';
const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
if (!motionPreference.matches && 'IntersectionObserver' in window) {
  const observer=new IntersectionObserver(entries=>{
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      if (!motionPreference.matches) entry.target.animate(
        [{opacity:0,translate:'0 18px'},{opacity:1,translate:'0 0'}],
        {duration:550,easing:'cubic-bezier(.2,.75,.25,1)'}
      );
    }
  });
  document.querySelectorAll('.cover-copy h1,.cover-copy p,.actions,.hero,.solutions article,.experience,.intro,.analysis-card,.guide,.planner,.section-heading,.quote-start').forEach(el=>observer.observe(el));
}
