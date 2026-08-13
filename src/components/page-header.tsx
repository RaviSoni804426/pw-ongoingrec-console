export const PageHeader = ({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) => (
  <div className="flex flex-wrap items-start justify-between gap-3 border-b px-6 py-4">
    <div>
      <h1 className="text-lg font-semibold">{title}</h1>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
    {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
  </div>
);
