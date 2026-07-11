import { PALETTE } from './colors.js'

export function confettiBurst(x, y) {
  if (document.documentElement.dataset.motion === 'off') return
  for (let i = 0; i < 16; i++) {
    const el = document.createElement('div')
    el.className = 'confetti'
    el.style.left = x + 'px'
    el.style.top = y + 'px'
    el.style.background = PALETTE[i % PALETTE.length]
    document.body.appendChild(el)
    const a = Math.random() * Math.PI * 2
    const d = 60 + Math.random() * 90
    el.animate(
      [
        { transform: 'translate(0,0) rotate(0)', opacity: 1 },
        {
          transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d + 150}px) rotate(${Math.random() * 540}deg)`,
          opacity: 0,
        },
      ],
      { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(.2,.6,.3,1)' }
    ).onfinish = () => el.remove()
  }
}
