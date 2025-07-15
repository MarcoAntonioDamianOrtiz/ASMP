<script setup lang="ts">
import { ref } from "vue";
import { useUserStore } from "@/stores/user";

const email = ref("");
const password = ref("");
const userStore = useUserStore();

const required = () => {
    userStore.required(email.value, password.value)
        .then(() => {
            console.log("Usuario registrado exitosamente");
            // Aquí puedes redirigir al usuario a otra página o mostrar un mensaje de éxito
        })
        .catch((error) => {
            console.error("Error al registrar el usuario:", error);
            // Aquí puedes manejar el error, por ejemplo, mostrar un mensaje de error al usuario
        });
}
</script>


<template>
  <div class="registrar">
    <h2>registrar</h2>
    <form @submit.prevent="required">
      <div class="registrar__input">
        <input type="email" required  v-model="email" />
        <label>Email</label>
      </div>
      <div class="registrar__input">
        <input type="password" required v-model="password" />
        <label>Password</label>
      </div>

      <button class="registrar__submit" type="submit">registrar</button>
    </form>
  </div>
</template>

<style>
.registrar {
  margin: 100px auto;
  width: 400px;
  padding: 40px;
  background: #282828;
  box-sizing: border-box;
  box-shadow: 0 15px 25px rgba(0, 0, 0, 0.6);
  border-radius: 10px;
}

.registrar h2 {
  margin-bottom: 30px;
  color: #fff;
  text-align: center;
}

.registrar .registrar__input {
  position: relative;
}

.register .registrar__input input {
  font-size: 18px;
  width: 100%;
  padding: 10px 0;
  color: #fff;
  margin-bottom: 30px;
  border: none;
  border-bottom: 1px solid #fff;
  outline: none;
  background: transparent;
}
.registrar .registrar__input label {
  position: absolute;
  top: 0;
  left: 0;
  padding: 10px 0;
  color: #fff;
  pointer-events: none;
  transition: 0.5s;
}

.registrar .registrar__input input:focus ~ label,
.registrar .registrar__input input:valid ~ label {
  top: -20px;
  left: 0;
  color: #03e9f4;
  font-size: 12px;
}

.registrar__submit {
  color: #1b1c1b;
  padding: 0.7em 1.7em;
  font-size: 18px;
  border-radius: 0.5em;
  background: #e8e8e8;
  border: none;
  cursor: pointer;
}
</style>