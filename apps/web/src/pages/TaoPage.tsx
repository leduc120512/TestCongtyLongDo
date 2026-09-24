import { useNavigate } from 'react-router'
import { FORM_TRONG, FormCongViec } from '../components/FormCongViec'
import { useTaoCongViec } from '../hooks/useCongViec'

export default function TaoPage() {
  const navigate = useNavigate()
  const tao = useTaoCongViec()

  return (
    <section className="hep">
      <h1>Tạo công việc</h1>
      <FormCongViec
        giaTriDau={FORM_TRONG}
        nutLuu="Tạo công việc"
        dangGui={tao.isPending}
        loiMayChu={tao.error?.message}
        onGui={(duLieu) => tao.mutate(duLieu, { onSuccess: (cv) => navigate(`/cong-viec/${cv.id}`) })}
        onHuy={() => navigate(-1)}
      />
    </section>
  )
}
