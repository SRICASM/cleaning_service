import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { Button } from './button';

const QuantityStepper = ({
  initialQuantity = 0,
  min = 0,
  max = 99,
  onChange,
  onAdd,
  addLabel = 'Add',
  size = 'default', // 'sm', 'default', 'lg'
  variant = 'default' // 'default', 'outline', 'ghost'
}) => {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [isActive, setIsActive] = useState(initialQuantity > 0);

  const handleAdd = () => {
    setIsActive(true);
    setQuantity(1);
    onChange?.(1);
    onAdd?.();
  };

  const handleIncrement = () => {
    if (quantity < max) {
      const newQty = quantity + 1;
      setQuantity(newQty);
      onChange?.(newQty);
    }
  };

  const handleDecrement = () => {
    if (quantity > min) {
      const newQty = quantity - 1;
      setQuantity(newQty);
      onChange?.(newQty);
      if (newQty === 0) {
        setIsActive(false);
      }
    } else if (min === 0) {
      setQuantity(0);
      setIsActive(false);
      onChange?.(0);
    }
  };

  const sizeClasses = {
    sm: 'h-8 text-sm',
    default: 'h-10',
    lg: 'h-12 text-lg'
  };

  const buttonSizeClasses = {
    sm: 'w-8 h-8',
    default: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  if (!isActive) {
    return (
      <Button
        onClick={handleAdd}
        variant={variant === 'outline' ? 'outline' : 'default'}
        className={`${sizeClasses[size]} rounded-full ${
          variant === 'default'
            ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
            : 'border-emerald-500 text-emerald-600 hover:bg-emerald-50'
        }`}
      >
        <Plus className="w-4 h-4 mr-1" />
        {addLabel}
      </Button>
    );
  }

  return (
    <div className={`inline-flex items-center rounded-full border-2 border-emerald-500 bg-white ${sizeClasses[size]}`}>
      <button
        onClick={handleDecrement}
        className={`${buttonSizeClasses[size]} flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-l-full transition-colors`}
      >
        <Minus className="w-4 h-4" />
      </button>
      <span className="w-8 text-center font-semibold text-green-900">
        {quantity}
      </span>
      <button
        onClick={handleIncrement}
        disabled={quantity >= max}
        className={`${buttonSizeClasses[size]} flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-r-full transition-colors disabled:opacity-50`}
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
};

export { QuantityStepper };
