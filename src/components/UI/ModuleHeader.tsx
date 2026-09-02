import React from 'react';
import '../Layout/AppLayout.css';

interface ModuleHeaderProps {
  title: string;
  icon?: React.ReactNode;
  extra?: React.ReactNode;
  subtitle?: string;
  eyebrow?: string;
  meta?: React.ReactNode[];
}

const ModuleHeader: React.FC<ModuleHeaderProps> = ({
  extra,
}) => {
  if (!extra) return null;

  return <div className="module-toolbar">{extra}</div>;
};

export default ModuleHeader;
