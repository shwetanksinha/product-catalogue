import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { enquiryRequestSchema, type EnquiryRequest } from '@catalogue/shared';
import { ApiError } from '../api/client';
import { useProduct, useSubmitEnquiry } from '../api/hooks';
import { ErrorState, Loading } from '../components/Status';

type FieldName = 'name' | 'email' | 'phone' | 'message';
type FieldErrors = Partial<Record<FieldName, string>>;

const emptyForm = { name: '', email: '', phone: '', message: '', website: '' };

export function EnquiryPage() {
  const { id = '' } = useParams();
  const product = useProduct(id);
  const submit = useSubmitEnquiry();
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  if (product.isPending) return <Loading label="Loading product…" />;
  if (product.error)
    return <ErrorState error={product.error} notFoundMessage="That product does not exist." />;

  const { title } = product.data.product;
  const productPath = `/products/${encodeURIComponent(id)}`;

  if (submit.isSuccess) {
    return (
      <section className="thank-you" aria-live="polite">
        <h1>Thank you!</h1>
        <p>
          We have received your enquiry about <strong>{title}</strong>. Our sales team will be in touch at{' '}
          <strong>{form.email}</strong> shortly.
        </p>
        <p>
          <Link to={productPath}>Back to product</Link> · <Link to="/">Continue browsing</Link>
        </p>
      </section>
    );
  }

  const update = (field: keyof typeof emptyForm) => (value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((errors) => ({ ...errors, [field]: undefined }));
  };

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: EnquiryRequest = { productId: id, ...form };
    // Client-side validation is for UX only; the API re-validates with the same schema.
    const parsed = enquiryRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as FieldName;
        errors[field] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    submit.mutate(payload, {
      onError: (error) => {
        if (error instanceof ApiError && error.fields) setFieldErrors(error.fields as FieldErrors);
      },
    });
  }

  const submitError =
    submit.error && !(submit.error instanceof ApiError && submit.error.fields) ? submit.error : null;

  return (
    <section className="enquiry">
      <p>
        <Link to={productPath}>← Back to product</Link>
      </p>
      <h1>Enquire about {title}</h1>
      <p className="muted">Leave your details and our sales team will get back to you.</p>

      <form onSubmit={onSubmit} noValidate className="form">
        <Field
          label="Name"
          name="name"
          required
          value={form.name}
          error={fieldErrors.name}
          onChange={update('name')}
          autoComplete="name"
          maxLength={100}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          required
          value={form.email}
          error={fieldErrors.email}
          onChange={update('email')}
          autoComplete="email"
          maxLength={254}
        />
        <Field
          label="Phone (optional)"
          name="phone"
          type="tel"
          value={form.phone}
          error={fieldErrors.phone}
          onChange={update('phone')}
          autoComplete="tel"
          maxLength={30}
        />
        <Field
          label="Message (optional)"
          name="message"
          multiline
          value={form.message}
          error={fieldErrors.message}
          onChange={update('message')}
          maxLength={2000}
        />

        {/* Honeypot: hidden from people and assistive tech; bots that fill it are silently dropped. */}
        <div className="honeypot" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(e) => update('website')(e.target.value)}
          />
        </div>

        {submitError && <ErrorState error={submitError} />}

        <button type="submit" className="button button--primary" disabled={submit.isPending}>
          {submit.isPending ? 'Sending…' : 'Send enquiry'}
        </button>
      </form>
    </section>
  );
}

interface FieldProps {
  label: string;
  name: FieldName;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  type?: string;
  required?: boolean;
  multiline?: boolean;
  autoComplete?: string;
  maxLength?: number;
}

function Field({
  label,
  name,
  value,
  onChange,
  error,
  type = 'text',
  required,
  multiline,
  autoComplete,
  maxLength,
}: FieldProps) {
  const id = `enquiry-${name}`;
  const errorId = `${id}-error`;
  const common = {
    id,
    name,
    value,
    required,
    maxLength,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea {...common} rows={5} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          {...common}
          type={type}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}
