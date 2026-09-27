export function coinIcon(extraClass = '') {
  const cls = ['jg-coin-icon', extraClass].filter(Boolean).join(' ');
  return `<img class="${cls}" src="/assets/fx/Caisse/JexonGo_Coin_frame_01.png" alt="" aria-hidden="true">`;
}

export function expIcon(extraClass = '') {
  const cls = ['jg-exp-icon', extraClass].filter(Boolean).join(' ');
  return `<img class="${cls}" src="/assets/fx/Caisse/JexonGo_EXP_frame_01.png" alt="EXP">`;
}
