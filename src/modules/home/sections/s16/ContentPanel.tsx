import type { FormEvent } from 'react';
import { CheckIcon } from './art';
import { HERO_PHOTO_FILE, SPECIAL_MAX_LENGTH } from './data';
import { useCopy } from './useCopy';
import css from './panels.module.css';
import type { SpecialEditor } from './useSpecialEditor';

/** One admin field on the page; a fixed id (useId differs across the lazy SSR boundary). */
const FIELD_ID = 'web-build-special';

interface ContentPanelProps {
  editor: SpecialEditor;
  hours: string;
}

/**
 * The admin panel: one real field ("Today's special") that the autopilot
 * edits and publishes, or the visitor does. Publishing updates the site's
 * announcement bar; nothing leaves the page (the form never submits).
 */
export default function ContentPanel({ editor, hours }: ContentPanelProps) {
  const { edit, onDraft, onTakeOver, onPublish } = editor;
  const copy = useCopy().panels.content;
  const isBusy = edit.status === 'publishing';
  const isPublished = edit.status === 'published';
  /** The autopilot is editing: show its selection and caret over the field. */
  const isAuto = edit.status === 'selecting' || edit.status === 'typing';
  const statusText = isPublished ? copy.published : isBusy ? copy.publishing : copy.draft;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isBusy) onPublish();
  };

  return (
    <form className={css.cms} onSubmit={submit} data-status={edit.status}>
      <p className={css.head}>
        {copy.title}
        <span className={css.status} data-published={isPublished ? 'true' : undefined}>
          {isPublished && <CheckIcon className={css.statusIcon} />}
          {statusText}
        </span>
      </p>
      <label className={css.fieldLabel} htmlFor={FIELD_ID}>
        {copy.field}
      </label>
      <div className={css.field} data-auto={isAuto ? edit.status : undefined}>
        {isAuto && (
          <span className={css.ghostText} aria-hidden='true'>
            <span className={css.ghostValue}>{edit.draft}</span>
            {edit.status === 'typing' && <span className={css.caret} />}
          </span>
        )}
        <input
          id={FIELD_ID}
          className={css.input}
          value={edit.draft}
          maxLength={SPECIAL_MAX_LENGTH}
          autoComplete='off'
          enterKeyHint='done'
          onPointerDown={onTakeOver}
          onFocus={onTakeOver}
          onChange={event => onDraft(event.target.value)}
        />
      </div>
      <dl className={css.rows}>
        <div className={css.row}>
          <dt>{copy.hoursLabel}</dt>
          <dd>{hours}</dd>
        </div>
        <div className={css.row}>
          <dt>{copy.photoLabel}</dt>
          <dd>{HERO_PHOTO_FILE}</dd>
        </div>
      </dl>
      <button type='submit' className={css.publish} data-busy={isBusy ? 'true' : undefined} aria-disabled={isBusy}>
        {isBusy ? copy.publishing : copy.publish}
      </button>
    </form>
  );
}
