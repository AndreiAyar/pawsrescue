"use client";

import { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";

interface IFormInput {
  catName: string;
  city: string;
  isLost: boolean;
  photos: FileList;
}

export default function CreatePetPage() {
  const [isFormLoading, setIsFormLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<IFormInput>();
  const onSubmit: SubmitHandler<IFormInput> = (data) => console.log(data);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>Form 1</div>
      
    </form>
  );
}
