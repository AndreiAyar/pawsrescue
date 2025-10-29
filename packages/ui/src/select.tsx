interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({ className, options, placeholder, ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={
        className +
        " border-1 outline-0 active:border-gray-400 px-1 py-2 w-full hover:border-gray-400 text-sm border-gray-300 rounded bg-white appearance-none cursor-pointer"
      }
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}