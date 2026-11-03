export default function FormField({ id, label, error, hint, ...inputProps }) {
  const description = [hint && id + '-hint', error && id + '-error'].filter(Boolean).join(' ') || undefined;
  return <div className="field"><label htmlFor={id}>{label}</label><input id={id} aria-invalid={Boolean(error)} aria-describedby={description} {...inputProps} />{hint && <p className="field-hint" id={id + '-hint'}>{hint}</p>}{error && <p className="field-error" id={id + '-error'}>{error}</p>}</div>;
}
