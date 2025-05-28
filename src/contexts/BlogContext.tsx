'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface BlogPost {
  generationGroupId?: string;
  locale: string;
  slug: string;
}

interface BlogContextType {
  currentPost: BlogPost | null;
  setCurrentPost: (post: BlogPost | null) => void;
}

const BlogContext = createContext<BlogContextType | undefined>(undefined);

export const BlogProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [currentPost, setCurrentPost] = useState<BlogPost | null>(null);

  return (
    <BlogContext.Provider value={{ currentPost, setCurrentPost }}>
      {children}
    </BlogContext.Provider>
  );
};

export const useBlogContext = () => {
  const context = useContext(BlogContext);

  if (context === undefined) {
    throw new Error('useBlogContext must be used within a BlogProvider');
  }

  return context;
};
