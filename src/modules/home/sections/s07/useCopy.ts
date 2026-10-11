'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  CARD_LAST4,
  NEXT_ORDER_NUMBER,
  ORDER_NUMBER,
  PREVIOUS_ORDER,
  formatPrice,
  type Currency,
  type MiniItemId,
  type PartId,
  type SizeId,
  type TimeId,
} from './data';

/**
 * Section 07's words for the route locale (`home.telegram`), resolved once
 * per locale and handed to every part of the demo through DemoContext. The
 * helpers fold in the data: names by id, prices in the locale's currency,
 * order numbers and the card's last digits.
 */
export function useS07Copy(currency: Currency) {
  const t = useTranslations('home.telegram');
  return useMemo(() => {
    const price = (amount: number) => formatPrice(amount, currency, t('units.soum'));
    const item = (id: MiniItemId) => t(`menu.${id}`);
    const size = (id: SizeId) => t(`sizes.${id}`);
    const time = (id: TimeId) => ({ name: t(`times.${id}.name`), pickup: t(`times.${id}.pickup`) });
    const orderLine = (itemId: MiniItemId, sizeId: SizeId) => t('orderLine', { item: item(itemId), size: size(sizeId) });
    const cafe = t('cafe');
    return {
      price,
      item,
      size,
      time,
      orderLine,
      previousOrder: orderLine(PREVIOUS_ORDER.item, PREVIOUS_ORDER.size),
      lead: t('lead'),
      legend: (id: PartId) => ({ term: t(`legend.${id}.term`), text: t(`legend.${id}.text`), action: t(`legend.${id}.action`) }),
      reach: t('reach'),
      proof: t('proof'),
      replay: t('replay'),
      hintTouch: t('hintTouch'),
      hintPointer: t('hintPointer'),
      demoLabel: t('demoLabel'),
      cursor: { tap: t('cursor.tap'), show: t('cursor.show') },
      cafe,
      chat: {
        subtitle: t('chat.subtitle'),
        typing: t('chat.typing'),
        today: t('chat.today'),
        inputPlaceholder: t('chat.inputPlaceholder'),
        menuButton: t('chat.menuButton'),
        hello: t('chat.hello'),
        greet: t('chat.greet'),
        askSize: t('chat.askSize'),
        askTime: t('chat.askTime'),
        cartTitle: t('chat.cartTitle'),
        pickupLabel: t('chat.pickupLabel'),
        totalLabel: t('chat.totalLabel'),
        pay: (total: string) => t('chat.pay', { total }),
        startOver: t('chat.startOver'),
        receiptTitle: t('chat.receiptTitle', { number: ORDER_NUMBER }),
        receiptPaid: (total: string) => t('chat.receiptPaid', { total, last4: CARD_LAST4 }),
        receiptPickup: (pickup: string) => t('chat.receiptPickup', { pickup }),
        ready: (id: MiniItemId) => t('chat.ready', { item: item(id), itemLower: item(id).toLowerCase() }),
        menuPrompt: t('chat.menuPrompt'),
        openMenu: t('chat.openMenu'),
      },
      pay: {
        title: t('pay.title'),
        order: t('pay.order', { number: ORDER_NUMBER }),
        cardLabel: t('pay.cardLabel'),
        cardHolder: t('pay.cardHolder'),
        codeLabel: t('pay.codeLabel'),
        codeSentTo: t('pay.codeSentTo'),
        button: (total: string) => t('pay.button', { total }),
        processing: t('pay.processing'),
        done: t('pay.done'),
        secure: t('pay.secure'),
      },
      admin: {
        title: t('admin.title'),
        live: t('admin.live'),
        status: { new: t('admin.status.new'), preparing: t('admin.status.preparing'), ready: t('admin.status.ready') },
        columns: { new: t('admin.columns.new'), preparing: t('admin.columns.preparing'), ready: t('admin.columns.ready') },
        markReady: t('admin.markReady'),
        paid: (total: string) => t('admin.paid', { total }),
        pickup: (pickup: string) => t('admin.pickup', { pickup }),
        previous: `#${ORDER_NUMBER - 1}`,
        miniNumber: `#${NEXT_ORDER_NUMBER}`,
        miniSource: t('admin.miniSource'),
        botSource: t('admin.botSource'),
        previousStatus: t('admin.previousStatus'),
        packetReady: t('admin.packetReady'),
        incoming: t('admin.incoming'),
        boardLabel: t('admin.boardLabel'),
        today: t('admin.today'),
        boardCafe: t('admin.kitchen', { cafe }),
        waiting: t('admin.waiting'),
      },
      mini: {
        close: t('mini.close'),
        subtitle: t('mini.subtitle'),
        greeting: t('mini.greeting'),
        note: t('mini.note'),
        category: (id: 'coffee' | 'bakery' | 'tea') => t(`mini.categories.${id}`),
        add: (name: string) => t('mini.add', { name }),
        remove: (name: string) => t('mini.remove', { name }),
        view: (count: number, total: string) => t('mini.view', { count, total }),
        sending: t('mini.sending'),
        sent: t('mini.sent', { number: NEXT_ORDER_NUMBER }),
      },
    };
  }, [t, currency]);
}

export type S07Copy = ReturnType<typeof useS07Copy>;
