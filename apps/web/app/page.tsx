"use client";
import Map from "./components/Map/Map";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Select } from "@repo/ui/select";
import { Checkbox } from "@repo/ui/checkbox";
import { FileUpload } from "@repo/ui/fileUpload";
import { FormField } from "@repo/ui/formField";
import { SubmitHandler, useForm } from "react-hook-form";

interface IFormInput {
  catName: string;
  city: string;
  isLost: boolean;
  photos: FileList;
}

// async function getCats() {
//   const apiUrl = process.env.NEXT_PUBLIC_API_URL;

//   const res = await fetch(`${apiUrl}/lost-pets/2`, { cache: "no-store" });
//   if (!res.ok) throw new Error("Failed to fetch cats");
//   return res.json();
// }

export default function Home() {
  //const cats = await getCats();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<IFormInput>();
  const onSubmit: SubmitHandler<IFormInput> = (data) => console.log(data);

  return (
    <div>
      <div className="w-[300px] h-[300px] bg-red-500">SALU!T</div>
        <Map />
      Interactive below
      <Button buttonType={"main"}>
        <div>Incepe!</div>
      </Button>
      <Button buttonType={"secondary"}>
        <div>Am vazut o pisica</div>
      </Button>
      -----
      <Button interactive={false} buttonType={"main"}>
        <div>Incepe!</div>
      </Button>
      <Button interactive={false} href="/lost-pet" buttonType={"secondary"}>
        <div>Detalii</div>
      </Button>
      <form onSubmit={handleSubmit(onSubmit)}>
        <FormField label="Cat name" name="catName" error={errors.catName?.message}>
          <Input
            id="catName"
            {...register("catName", {
              required: "Cat name is required",
              setValueAs: (value: string) => value.trim(),
              maxLength: {
              value: 20,
              message: "Cat name must be at most 20 characters",
              },
              minLength: {
              value: 2,
              message: "Cat name must be at least 2 characters",
              },
              pattern: {
              value: /^[a-zA-Z0-9 ]+$/,
              message: "No special characters allowed",
              },
            })}
          />
        </FormField>

        <FormField label="City" name="city" error={errors.city?.message}>
          <Select
            id="city"
            {...register("city", { required: "Please select a city" })}
            options={[
              { value: "", label: "Select a city" },
              { value: "nyc", label: "New York" },
              { value: "la", label: "Los Angeles" },
            ]}
            placeholder="Select a city"
          />
        </FormField>

        <Checkbox
          id="isLost"
          {...register("isLost")}
          label="This pet is currently lost"
        />

        <FormField label="Pet Photos" name="photos" error={errors.photos?.message}>
          <FileUpload
            id="photos"
            {...register("photos", {
              required: "Please upload at least one photo",
            })}
            maxFiles={5}
          />
        </FormField>

        <Button buttonType="main" type="submit">
          Submit Pet Info
        </Button>
      </form>
      {/* <pre>{JSON.stringify(cats, null, 2)}</pre> */}
    
    </div>
  );
}
