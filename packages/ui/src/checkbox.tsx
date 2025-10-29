interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  label?: string;
  labelClassName?: string;
}

export function Checkbox({ className, label, labelClassName, ...props }: CheckboxProps) {
  const checkboxElement = (
    <input
      type="checkbox"
      {...props}
      className={
        className +
        " w-4 h-4 border-1 border-gray-300 rounded cursor-pointer accent-blue-600 hover:border-gray-400 focus:outline-0 focus:ring-2 focus:ring-blue-200"
      }
    />
  );

  if (label) {
    return (
      <label className="flex items-center cursor-pointer">
        {checkboxElement}
        <span className={
          labelClassName + 
          " ml-2 text-sm text-gray-700 select-none"
        }>
          {label}
        </span>
      </label>
    );
  }

  return checkboxElement;
}