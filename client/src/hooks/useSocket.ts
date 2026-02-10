import { useEffect } from 'react';
import { getSocket } from '../services/socket';
import { useCartStore } from '../stores/cartStore';
import { useAlertStore } from '../stores/alertStore';
import { useEmergencyScreenStore } from '../stores/emergencyScreenStore';

export function useSocket(): void {
  const setCarts = useCartStore((s) => s.setCarts);
  const updateCart = useCartStore((s) => s.updateCart);
  const removeCart = useCartStore((s) => s.removeCart);
  const addAlert = useAlertStore((s) => s.addAlert);

  useEffect(() => {
    const socket = getSocket();

    socket.on('timer:tick', (carts) => {
      setCarts(carts);
    });

    socket.on('cart:created', (cart) => {
      updateCart(cart);
    });

    socket.on('cart:updated', (cart) => {
      updateCart(cart);
    });

    socket.on('cart:deleted', (cartId) => {
      removeCart(cartId);
    });

    socket.on('cart:ended', () => {
      // Cart ended - will be removed from active list on next tick
    });

    socket.on('checkin:recorded', ({ cart }) => {
      updateCart(cart);
    });

    socket.on('alert:warning', (cart) => {
      addAlert('warning', cart);
    });

    socket.on('alert:overdue', (cart) => {
      addAlert('overdue', cart);
      useEmergencyScreenStore.getState().startEmergency(cart.id, cart.cart_number, cart.diver_names);
    });

    socket.on('alert:emergency', (cart) => {
      addAlert('emergency', cart);
    });

    return () => {
      socket.off('timer:tick');
      socket.off('cart:created');
      socket.off('cart:updated');
      socket.off('cart:deleted');
      socket.off('cart:ended');
      socket.off('checkin:recorded');
      socket.off('alert:warning');
      socket.off('alert:overdue');
      socket.off('alert:emergency');
    };
  }, [setCarts, updateCart, removeCart, addAlert]);
}
