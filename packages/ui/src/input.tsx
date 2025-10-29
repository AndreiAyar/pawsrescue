interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  placeholder?: string;
}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      {...props}
      placeholder="Type your text here..."
      className={
        className +
        " border-1 outline-0 active:border-gray-400 px-1 py-2 w-full hover:border-gray-400 text-sm border-gray-300 rounded placeholder:text-sm"
      }
    />
  );
}
