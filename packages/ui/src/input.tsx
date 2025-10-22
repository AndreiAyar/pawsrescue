export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { className: string }) {
  return <input {...props} className={className + ' border border-4 border-gray-300'} />;
}
