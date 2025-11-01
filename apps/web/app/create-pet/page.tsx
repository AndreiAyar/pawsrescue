"use client";

import { useState } from "react";

export default function CreatePetPage() {
  const [isFormLoading, setIsFormLoading] = useState(false);
  const handleSubmit = () => {
    return null;
  };
  return (
    <form onSubmit={handleSubmit}>
      <div>Form 1</div>
    </form>
  );
}
