import React, { useState, useEffect } from 'react';
import { theme as t } from '@/styles/theme.js';
import { isUrgent } from '@/utils/format.js';

export default function DeadlineTimer({ deadline }) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    function update() {
      const diff = Number(deadline) - Math.floor(Date.now() / 1000);
      if (diff <= 0) { setLabel('Expired'); return; }
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      if (d > 1) setLabel(d + 'd ' + h + 'h');
      else if (d === 1) setLabel('1d ' + h + 'h ' + m + 'm');
      else if (h > 0)   setLabel(h + 'h ' + m + 'm');
      else              setLabel(m + 'm ' + s + 's');
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const urgent = isUrgent(deadline);
  return (
    <span style={{
      fontFamily: t.fonts.mono,
      fontSize: '12px',
      color: urgent ? '#f87171' : t.colors.text.muted,
      fontWeight: 500,
    }}>
      {label}
    </span>
  );
}
