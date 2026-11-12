export const activityLabels: Record<string, string> = {
  registered: "Регистрация",
  login: "Вход в систему",
  email_verified: "E-mail подтверждён",
  email_changed: "E-mail изменён",
  password_changed: "Пароль изменён",
  password_reset: "Пароль восстановлен",
  enrolled: "Запись на курс",
  access_granted: "Открыт доступ к курсу",
  access_revoked: "Закрыт доступ к курсу",
  lesson_completed: "Урок пройден",
  course_completed: "Курс завершён",
  test_passed: "Тест сдан",
  test_failed: "Тест не сдан",
  assignment_submitted: "Отправлено задание",
};

export function activityLabel(action: string) {
  return activityLabels[action] ?? action;
}
