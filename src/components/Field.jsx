export function Field({ label, ...rest }) {
  return (
    <>
      <label>{label}</label>
      <input {...rest} />
    </>
  )
}
