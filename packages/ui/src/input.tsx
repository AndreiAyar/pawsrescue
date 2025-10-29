export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return <input {...props} className={className + ' border-1 outline-0 border-gray-300'} />;
}
