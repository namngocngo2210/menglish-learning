export interface TopicDef {
  slug: string;
  name: string;
  summary: string;
  intro: string[];
  examples?: { en: string; vi: string }[];
  tips?: string[];
}
export const TOPIC_REGISTRY: Record<"ngu-phap" | "tu-vung", TopicDef[]> = {
  "ngu-phap": [
    {
      slug: "thi-hien-tai-don",
      name: "Thì hiện tại đơn",
      summary: "Ôn thói quen, sự thật và cách chia động từ ở thì hiện tại đơn.",
      intro: [
        "Thì hiện tại đơn diễn tả thói quen, lịch sinh hoạt và sự thật tương đối ổn định. Với động từ thường, công thức khẳng định là S + V; riêng he, she, it hoặc danh từ số ít dùng V-s/es. Những từ như every day, usually, often giúp em nhận ra một hành động lặp lại. Hãy đọc cả chủ ngữ trước khi chọn dạng động từ, thay vì chỉ nhìn từ đứng cạnh chỗ trống.",
        "Câu phủ định dùng do not hoặc does not + động từ nguyên mẫu; câu hỏi đưa Do hoặc Does lên trước chủ ngữ. Đừng thêm s sau does, đừng dùng do với động từ be và đừng nhầm thói quen với việc đang xảy ra ngay lúc nói. Khi luyện, em có thể viết lịch một ngày rồi đổi từng câu thành phủ định và nghi vấn.",
      ],
      examples: [
        { en: "Minh waters the plants every morning.", vi: "Minh tưới cây mỗi sáng." },
        { en: "Does your sister walk to school?", vi: "Chị của em có đi bộ đến trường không?" },
      ],
      tips: [
        "Sau does hoặc doesn't, dùng động từ nguyên mẫu.",
        "Chủ ngữ số nhiều không thêm s vào động từ thường.",
      ],
    },
    {
      slug: "thi-hien-tai-tiep-dien",
      name: "Thì hiện tại tiếp diễn",
      summary: "Luyện am/is/are + V-ing để nói về hành động đang diễn ra.",
      intro: [
        "Thì hiện tại tiếp diễn thường kể một việc đang xảy ra lúc nói hoặc trong giai đoạn hiện tại. Công thức là S + am/is/are + V-ing: I đi với am, he/she/it đi với is, các chủ ngữ còn lại dùng are. Những dấu hiệu như now, at the moment hoặc lời nhắc Look! thường gợi ý cách dùng này. Tuy nhiên, ý nghĩa của cả câu vẫn quan trọng hơn một từ nhận biết riêng lẻ.",
        "Muốn phủ định, thêm not sau am/is/are; muốn hỏi, chuyển động từ be lên trước chủ ngữ. Lỗi hay gặp là bỏ mất be, chọn sai is/are hoặc giữ nguyên động từ sau be mà quên ing. Em nên mô tả những người đang làm việc trong một bức tranh và đối chiếu từng chủ ngữ với trợ động từ phù hợp.",
      ],
      examples: [
        { en: "I am drawing a map now.", vi: "Bây giờ tôi đang vẽ một tấm bản đồ." },
        { en: "The children are building a sandcastle.", vi: "Bọn trẻ đang xây một lâu đài cát." },
      ],
      tips: [
        "Không bỏ am/is/are trước V-ing.",
        "write chuyển thành writing; run chuyển thành running.",
      ],
    },
    {
      slug: "thi-qua-khu-don",
      name: "Thì quá khứ đơn",
      summary: "Kể sự việc đã kết thúc bằng động từ quá khứ và did.",
      intro: [
        "Thì quá khứ đơn dùng cho hành động đã xảy ra và kết thúc trong quá khứ. Công thức với động từ thường là S + V2/ed. Động từ có quy tắc thường thêm ed, còn động từ bất quy tắc cần học theo cặp như go–went, see–saw. Yesterday, last week, two days ago hoặc một năm đã qua thường xác định thời điểm. Một câu kể chuyện cũng có thể dùng quá khứ dù không lặp lại dấu hiệu thời gian.",
        "Trong câu phủ định và câu hỏi, did mang ý nghĩa quá khứ nên động từ chính trở về nguyên mẫu: did not go, Did you go? Đừng viết did went, đừng thêm ed cho mọi động từ bất quy tắc và đừng dùng was thay did trước động từ thường. Viết ba việc em làm hôm qua sẽ giúp em gắn dạng động từ với trải nghiệm cụ thể.",
      ],
      examples: [
        { en: "We planted a tree yesterday.", vi: "Chúng tôi trồng một cây hôm qua." },
        { en: "Lan did not take the bus.", vi: "Lan đã không đi xe buýt." },
      ],
      tips: ["Học động từ bất quy tắc trong câu ngắn.", "Sau did và didn't dùng V nguyên mẫu."],
    },
    {
      slug: "thi-qua-khu-tiep-dien",
      name: "Thì quá khứ tiếp diễn",
      summary: "Dùng was/were + V-ing cho hành động đang diễn ra ở một thời điểm quá khứ.",
      intro: [
        "Thì quá khứ tiếp diễn đặt người đọc vào giữa một hành động đang diễn ra ở thời điểm quá khứ. Công thức là S + was/were + V-ing. I, he, she, it và danh từ số ít thường dùng was; you, we, they dùng were. Em có thể dùng thì này làm nền cho một sự kiện khác xen vào, chẳng hạn đang đọc sách thì chuông cửa reo. Sự kiện ngắn xen vào thường ở quá khứ đơn.",
        "While thường nối các hành động đang diễn ra song song, nhưng không phải cứ thấy when hay while là chọn máy móc một thì. Hãy hình dung việc nào kéo dài, việc nào xảy đến. Tránh bỏ V-ing sau was/were, dùng were với she hoặc biến cả hai hành động thành quá khứ tiếp diễn khi một việc chỉ là sự kiện xen vào.",
      ],
      examples: [
        {
          en: "I was packing my bag at eight last night.",
          vi: "Tôi đang xếp cặp lúc tám giờ tối qua.",
        },
        { en: "They were reading when the bell rang.", vi: "Họ đang đọc thì chuông reo." },
      ],
      tips: [
        "Phân biệt hành động nền và sự kiện xen vào.",
        "Dùng wasn't/weren't + V-ing để phủ định.",
      ],
    },
    {
      slug: "thi-tuong-lai-don",
      name: "Thì tương lai đơn",
      summary: "Luyện will + động từ nguyên mẫu để dự đoán, hứa và quyết định tức thời.",
      intro: [
        "Thì tương lai đơn có công thức S + will + động từ nguyên mẫu. Will giữ nguyên với mọi chủ ngữ nên em không cần thêm s dù chủ ngữ là he hay she. Thì này thường xuất hiện trong lời hứa, dự đoán hoặc quyết định đưa ra ngay lúc nói. Tomorrow, next week có thể đi kèm, nhưng những cụm thời gian ấy cũng dùng được với các cách diễn đạt tương lai khác tùy ngữ cảnh.",
        "Phủ định của will là will not, viết gọn thành won't; câu hỏi chuyển will lên trước chủ ngữ. Những lỗi cần tránh gồm will goes, will to go và nhầm won't với want. Em hãy tập đáp lại tình huống nhỏ như bạn quên bút bằng một lời đề nghị giúp đỡ có will, rồi viết thêm một dự đoán có lý do của riêng mình.",
      ],
      examples: [
        { en: "I will lend you my ruler.", vi: "Tôi sẽ cho bạn mượn thước." },
        {
          en: "Our team will finish the poster tomorrow.",
          vi: "Nhóm chúng tôi sẽ hoàn thành tấm áp phích vào ngày mai.",
        },
      ],
      tips: ["Will luôn đi với V nguyên mẫu không có to.", "Won't mang nghĩa phủ định."],
    },
    {
      slug: "thi-hien-tai-hoan-thanh",
      name: "Thì hiện tại hoàn thành",
      summary: "Ôn have/has + phân từ quá khứ và mối liên hệ giữa quá khứ với hiện tại.",
      intro: [
        "Thì hiện tại hoàn thành có cấu trúc S + have/has + V3/ed. I, you, we, they dùng have; he, she, it dùng has. Thì này nối một việc trong quá khứ với hiện tại: kinh nghiệm chưa nêu thời điểm cụ thể, kết quả còn thấy được hoặc trạng thái bắt đầu trước đây và vẫn tiếp tục. Since chỉ mốc bắt đầu, còn for chỉ khoảng thời gian; em nên học hai cách dùng này bằng các ví dụ riêng.",
        "Ever, never, already và yet thường gặp trong bài tập hoàn thành. Tuy vậy, khi câu nói rõ một thời điểm đã kết thúc như yesterday, quá khứ đơn thường phù hợp hơn. Đừng dùng has với they, đừng thay phân từ bằng nguyên mẫu và đừng nhầm since với for. Hãy kể những việc em đã làm trong tuần còn đang tiếp diễn để luyện mối liên hệ thời gian.",
      ],
      examples: [
        { en: "Mai has lost her library card.", vi: "Mai làm mất thẻ thư viện rồi." },
        { en: "We have lived here for three years.", vi: "Chúng tôi sống ở đây được ba năm rồi." },
      ],
      tips: ["Phân từ của write là written, không phải wrote.", "For three days; since Monday."],
    },
    {
      slug: "thi-qua-khu-hoan-thanh",
      name: "Thì quá khứ hoàn thành",
      summary: "Xác định việc xảy ra trước một mốc quá khứ bằng had + phân từ quá khứ.",
      intro: [
        "Thì quá khứ hoàn thành giúp làm rõ một hành động xảy ra trước một hành động hoặc mốc khác trong quá khứ. Công thức S + had + V3/ed giống nhau với mọi chủ ngữ. Khi kể việc đến sân ga rồi nhận ra tàu đã rời đi, hành động tàu rời đi đứng trước việc đến ga. Vẽ hai điểm trên một trục thời gian giúp em chọn thì theo thứ tự thực tế, thay vì thứ tự các vế trong câu.",
        "Câu phủ định thêm not sau had, còn câu hỏi đưa had lên đầu. Không phải mọi câu có before hoặc after đều bắt buộc dùng quá khứ hoàn thành nếu trình tự đã rõ. Tránh dùng had went thay had gone, chia had theo số ít số nhiều hoặc dùng thì này khi chỉ kể một sự việc quá khứ độc lập không có điểm tham chiếu.",
      ],
      examples: [
        {
          en: "The bus had left before we arrived.",
          vi: "Xe buýt đã rời đi trước khi chúng tôi đến.",
        },
        { en: "Hoa had packed her books by nine.", vi: "Đến chín giờ, Hoa đã xếp sách xong." },
      ],
      tips: ["Had không đổi theo chủ ngữ.", "Tìm mốc quá khứ thứ hai trước khi chọn thì."],
    },
    {
      slug: "dong-tu-khuyet-thieu",
      name: "Động từ khuyết thiếu (modal)",
      summary: "Phân biệt khả năng, sự cho phép, lời khuyên và nghĩa vụ qua động từ khuyết thiếu.",
      intro: [
        "Các động từ khuyết thiếu can, could, may, might, must, should, would, shall diễn tả thái độ của người nói đối với hành động. Can thường chỉ khả năng hoặc sự cho phép; should đưa lời khuyên; must nêu nghĩa vụ mạnh; may và might diễn tả khả năng xảy ra. Mẫu cơ bản là S + modal + động từ nguyên mẫu không có to. Riêng ought thường đi với to, nên cần nhớ cụm ought to khi gặp trong bài.",
        "Modal không thêm s với chủ ngữ số ít. Phủ định đặt not sau modal; câu hỏi thường đảo modal lên trước chủ ngữ. Tránh viết can swims, must to leave và hiểu mustn't là không cần: mustn't nghĩa là không được phép, còn không cần thường dùng don't have to. Em hãy thử diễn đạt cùng một hành động dưới dạng lời khuyên, khả năng và quy định để cảm nhận sắc thái.",
      ],
      examples: [
        { en: "You should rest after the match.", vi: "Bạn nên nghỉ sau trận đấu." },
        { en: "My brother can repair a bicycle.", vi: "Anh tôi có thể sửa xe đạp." },
      ],
      tips: [
        "Can/could/must/should + V nguyên mẫu.",
        "Ought to là trường hợp cần nhớ riêng.",
        "Mustn't diễn tả sự cấm đoán.",
      ],
    },
    {
      slug: "dong-tu-nguyen-mau-co-to",
      name: 'Động từ nguyên mẫu có "to"',
      summary: "Luyện to + động từ nguyên mẫu sau động từ phù hợp và để diễn đạt mục đích.",
      intro: [
        "Động từ nguyên mẫu có to gồm to + dạng gốc của động từ, chẳng hạn to read, to build. Cấu trúc này theo sau nhiều động từ quen thuộc như want, hope, decide, plan hoặc được dùng để nêu mục đích của một hành động. Trong câu nói đến thư viện để mượn sách, phần to borrow cho biết lý do đến đó. Dù chủ ngữ là số ít hay câu đang ở quá khứ, động từ sau to vẫn giữ dạng nguyên mẫu.",
        "Không phải mọi chữ to đều là dấu hiệu của động từ nguyên mẫu: trong look forward to, to là giới từ và có thể đi với V-ing. Em cũng cần phân biệt enjoy doing với want to do. Lỗi phổ biến là thêm s sau to, dùng to went hoặc đặt to sau can. Hãy ghi nhớ từng cụm động từ bằng một câu hoàn chỉnh thay vì học một danh sách rời rạc.",
      ],
      examples: [
        {
          en: "Linh hopes to join the art club.",
          vi: "Linh hy vọng tham gia câu lạc bộ mỹ thuật.",
        },
        {
          en: "I opened the window to get fresh air.",
          vi: "Tôi mở cửa sổ để đón không khí trong lành.",
        },
      ],
      tips: [
        "Want to learn nhưng enjoy learning.",
        "Phân biệt to là giới từ với to đứng trước động từ nguyên mẫu.",
      ],
    },
    {
      slug: "dong-tu-to-be",
      name: "Động từ to be (am, is, are)",
      summary: "Chọn am, is, are theo chủ ngữ để giới thiệu, mô tả và nói vị trí.",
      intro: [
        "Ở hiện tại, động từ be có ba dạng am, is, are. I dùng am; he, she, it và danh từ số ít dùng is; you, we, they và danh từ số nhiều dùng are. Be có thể nối chủ ngữ với danh từ để giới thiệu, tính từ để mô tả hoặc cụm chỉ nơi chốn để nói vị trí. Khi dịch từ tiếng Việt, em cần nhớ câu tiếng Anh thường phải có be trước tính từ, dù tiếng Việt không dùng từ là.",
        "Câu phủ định đặt not ngay sau be; câu hỏi chuyển be lên trước chủ ngữ mà không cần do hay does. Đừng viết She beautiful, They is hoặc Does he is tired? Hãy thay chủ ngữ trong một câu từ I sang my friends rồi kiểm tra dạng be. Bài luyện này tập trung vào be đứng làm động từ chính, khác với be làm trợ động từ trong thì tiếp diễn hay câu bị động.",
      ],
      examples: [
        { en: "I am ready for the lesson.", vi: "Tôi đã sẵn sàng cho tiết học." },
        { en: "Are your keys on the desk?", vi: "Chìa khóa của bạn có ở trên bàn không?" },
      ],
      tips: ["You luôn đi với are ở hiện tại.", "Không thêm do/does khi hỏi với be."],
    },
    {
      slug: "so-sanh",
      name: "So sánh hơn và so sánh nhất",
      summary: "Ôn dạng so sánh của tính từ, trạng từ và các từ bất quy tắc thường gặp.",
      intro: [
        "So sánh hơn thường đối chiếu hai đối tượng: tính từ ngắn thêm er + than, tính từ dài thường dùng more + tính từ + than. So sánh nhất chọn đối tượng nổi bật trong một nhóm, thường có the + tính từ ngắn thêm est hoặc the most + tính từ dài. Good có dạng better, best; bad có worse, worst. Mẫu as + tính từ gốc + as diễn tả mức độ ngang nhau, không dùng dạng so sánh hơn ở giữa.",
        "Một số tính từ hai âm tiết có hơn một cách so sánh chấp nhận được, vì vậy cần học theo từ thay vì chỉ đếm âm tiết máy móc. Những lỗi hay gặp gồm more taller, thiếu than khi cần vế đối chiếu và nhầm best với better trong so sánh hai người. Hãy chọn ba đồ vật quanh em rồi mô tả kích thước, giá hoặc độ tiện lợi bằng các cấu trúc khác nhau.",
      ],
      examples: [
        { en: "This path is shorter than the road.", vi: "Lối này ngắn hơn con đường kia." },
        {
          en: "Mai is the tallest student in our group.",
          vi: "Mai là học sinh cao nhất nhóm chúng tôi.",
        },
      ],
      tips: ["Không ghép more với taller.", "As tall as dùng tall, không dùng taller."],
    },
    {
      slug: "cau-dieu-kien",
      name: "Câu điều kiện",
      summary: "Liên kết điều kiện và kết quả với if, unless cùng các dạng động từ phù hợp.",
      intro: [
        "Câu điều kiện gồm mệnh đề nêu điều kiện và mệnh đề nêu kết quả. Với điều có thể xảy ra trong tương lai, mẫu thường gặp là If + S + hiện tại đơn, S + will + V. Với tình huống giả định khó có thật ở hiện tại, dùng If + S + quá khứ đơn, S + would + V. Were thường được dùng cho mọi chủ ngữ trong giả định với be, nhất là trong lời khuyên If I were you.",
        "Unless thường mang nghĩa if not, vì vậy phải kiểm tra kỹ ý phủ định trước khi đổi câu. Điều kiện về quá khứ trái thực tế có thể dùng had + V3 và would have + V3. Tránh đặt will vào mệnh đề if của mẫu tương lai cơ bản, trộn tùy tiện hai mẫu hoặc thêm not sau unless khi không có ý phủ định kép. Em nên xác định tình huống thật hay giả định trước khi chia động từ.",
      ],
      examples: [
        {
          en: "If it rains, we will practise indoors.",
          vi: "Nếu trời mưa, chúng tôi sẽ tập trong nhà.",
        },
        { en: "If I had a garden, I would grow beans.", vi: "Nếu có vườn, tôi sẽ trồng đậu." },
      ],
      tips: ["Unless gần nghĩa với if not.", "Dùng dấu phẩy khi mệnh đề if đứng đầu câu."],
    },
    {
      slug: "cau-bi-dong",
      name: "Câu bị động",
      summary: "Dùng be + phân từ quá khứ khi muốn nhấn mạnh đối tượng chịu tác động.",
      intro: [
        "Câu bị động đưa đối tượng chịu tác động lên làm chủ ngữ. Công thức cốt lõi là S + be + V3/ed; dạng của be thay đổi theo thì và chủ ngữ. Hiện tại đơn có am/is/are + V3, quá khứ đơn có was/were + V3. Người thực hiện có thể được nêu bằng by, nhưng thường bỏ nếu không rõ hoặc không quan trọng. Chỉ những động từ có tân ngữ phù hợp mới thường chuyển sang cấu trúc bị động này.",
        "Khi đổi từ chủ động, hãy tìm tân ngữ, đưa nó lên đầu rồi giữ đúng thì của động từ bằng dạng be tương ứng. Đừng quên be, đừng dùng V-ing thay phân từ và đừng thêm by một cách bắt buộc vào mọi câu. So sánh câu về người làm chiếc bánh với câu nhấn mạnh chiếc bánh sẽ giúp em hiểu lựa chọn trọng tâm, thay vì chỉ làm phép đổi vị trí từ.",
      ],
      examples: [
        { en: "The classroom is cleaned every afternoon.", vi: "Lớp học được dọn mỗi chiều." },
        { en: "This bridge was built in 2008.", vi: "Cây cầu này được xây vào năm 2008." },
      ],
      tips: ["Be thể hiện thì; phân từ chính giữ nguyên.", "Không nhầm is making với is made."],
    },
    {
      slug: "gioi-tu",
      name: "Giới từ",
      summary: "Học giới từ trong cụm chỉ thời gian, vị trí, hướng đi và cụm từ cố định.",
      intro: [
        "Giới từ thường đứng trước danh từ, đại từ hoặc cụm danh từ để diễn tả quan hệ về nơi chốn, thời gian hay hướng đi. Với thời gian, at thường đi cùng giờ, on đi cùng ngày, in đi cùng tháng hoặc năm. Với vị trí, in gợi ý bên trong, on thường là trên bề mặt, at xem địa điểm như một điểm. Đây là các hướng dẫn ban đầu; mỗi giới từ còn có nhiều cách dùng theo ngữ cảnh cụ thể.",
        "Nhiều động từ và tính từ đi với giới từ cố định như depend on, listen to, interested in. Đừng dịch từng từ tiếng Việt để đoán giới từ, đừng nhầm in Monday với on Monday và đừng bỏ to trong listen to music. Em nên vẽ sơ đồ vị trí rồi đặt câu, đồng thời ghi các cụm cố định vào sổ theo cả cụm. Sau giới từ, động từ thường chuyển sang dạng V-ing nếu cần diễn tả hành động.",
      ],
      examples: [
        { en: "Our club meets on Fridays.", vi: "Câu lạc bộ chúng tôi gặp nhau vào các thứ Sáu." },
        { en: "The cat is under the bench.", vi: "Con mèo ở dưới ghế dài." },
      ],
      tips: ["At seven; on Tuesday; in July.", "Học depend on thành một cụm."],
    },
    {
      slug: "mao-tu",
      name: "Mạo từ a, an, the",
      summary: "Phân biệt a, an, the và trường hợp không dùng mạo từ theo nghĩa của danh từ.",
      intro: [
        "A và an thường giới thiệu một người hoặc vật chưa xác định với danh từ đếm được số ít. Chọn a hay an theo âm đầu khi phát âm từ tiếp theo, không chỉ theo chữ cái: a uniform nhưng an hour. The thường dùng khi người nghe đã xác định được đối tượng, chẳng hạn vật đã nhắc ở câu trước hoặc vật được mô tả đủ rõ. Vì vậy, cùng một danh từ có thể dùng mạo từ khác nhau ở các ngữ cảnh khác nhau.",
        "Khi nói chung về danh từ số nhiều hoặc danh từ không đếm được, ta thường không dùng mạo từ: books, water. Tránh a information, quên a/an trước danh từ nghề nghiệp số ít hoặc tự động thêm the trước mọi danh từ. Hãy kể chuyện ngắn có một vật mới xuất hiện, rồi nhắc lại vật ấy bằng the để hiểu sự thay đổi từ chưa xác định sang đã xác định trong mạch văn.",
      ],
      examples: [
        {
          en: "I found a shell. The shell was pink.",
          vi: "Tôi tìm thấy một vỏ sò. Vỏ sò ấy màu hồng.",
        },
        { en: "My aunt is an engineer.", vi: "Dì tôi là một kỹ sư." },
      ],
      tips: ["An hour vì h không được phát âm.", "A/an không đứng trước danh từ số nhiều."],
    },
    {
      slug: "tinh-tu-so-huu",
      name: "Tính từ sở hữu",
      summary: "Chọn my, your, his, her, its, our, their trước danh từ để nói sự sở hữu.",
      intro: [
        "Tính từ sở hữu cho biết một vật, người hoặc mối quan hệ thuộc về ai và đứng trước danh từ: my bag, her brother. Các cặp cần nhớ là I–my, you–your, he–his, she–her, it–its, we–our, they–their. Dạng tính từ sở hữu phụ thuộc vào người sở hữu chứ không phụ thuộc số lượng của vật được sở hữu. Vì thế her book và her books đều dùng her nếu người sở hữu là một bạn nữ.",
        "Đừng nhầm tính từ sở hữu với đại từ sở hữu: my cần danh từ đi sau, còn mine có thể đứng độc lập. Its diễn tả sở hữu, trong khi it's là viết tắt của it is hoặc it has. Em cũng không đặt the trước my trong cụm danh từ thông thường. Khi luyện, hãy chỉ rõ ai sở hữu từng đồ vật rồi thay tên người đó bằng tính từ sở hữu tương ứng.",
      ],
      examples: [
        {
          en: "Nam keeps his notebook in this drawer.",
          vi: "Nam giữ vở của mình trong ngăn kéo này.",
        },
        {
          en: "Our neighbours wash their car on Sundays.",
          vi: "Hàng xóm của chúng tôi rửa xe của họ vào Chủ nhật.",
        },
      ],
      tips: ["My pencil nhưng The pencil is mine.", "Its không có dấu nháy khi chỉ sở hữu."],
    },
    {
      slug: "cau-hoi",
      name: "Câu hỏi",
      summary: "Sắp xếp từ hỏi, trợ động từ và chủ ngữ để tạo câu hỏi tiếng Anh rõ nghĩa.",
      intro: [
        "Câu hỏi Yes/No thường bắt đầu bằng be, trợ động từ hoặc động từ khuyết thiếu. Với động từ thường ở hiện tại đơn, dùng Do/Does + S + V?; ở quá khứ đơn dùng Did + S + V? Khi cần hỏi thông tin, thêm từ hỏi như where, when, why, how trước mẫu ấy. Be được đảo trực tiếp lên trước chủ ngữ, còn can hay will cũng đứng trước chủ ngữ mà không cần thêm do.",
        "Câu hỏi chủ ngữ là ngoại lệ quan trọng: Who broke the cup? không thêm did theo mẫu hỏi tân ngữ thông thường. Tránh Does she likes, Where you live? trong câu hỏi trực tiếp và đảo từ trong mệnh đề hỏi gián tiếp như I know where she lives. Em nên xác định thông tin muốn biết là người, nơi, thời gian hay lý do, sau đó kiểm tra thì và trật tự từ của câu hỏi.",
      ],
      examples: [
        { en: "Where does your cousin study?", vi: "Anh chị em họ của bạn học ở đâu?" },
        { en: "Can we borrow these books?", vi: "Chúng em có thể mượn những cuốn sách này không?" },
      ],
      tips: [
        "Sau does/did dùng động từ nguyên mẫu.",
        "Who làm chủ ngữ không cần do/does/did trong câu hỏi khẳng định thông thường.",
      ],
    },
  ],
  "tu-vung": [
    {
      slug: "gia-dinh-ban-be",
      name: "Gia đình và bạn bè",
      summary: "Học từ về người thân, tình bạn và cách mô tả các mối quan hệ gần gũi.",
      intro: [
        "Chủ đề gia đình và bạn bè giúp em giới thiệu những người gần gũi và kể chuyện sinh hoạt hằng ngày. Các từ nền tảng gồm mother: mẹ, father: bố, parent: cha hoặc mẹ, sister: chị hoặc em gái, brother: anh hoặc em trai, cousin: anh chị em họ, aunt: cô hoặc dì, uncle: chú hoặc bác, neighbour: hàng xóm, friend: bạn. Khi gặp một từ chỉ người thân, hãy xác định rõ quan hệ thay vì dịch chung tất cả thành người nhà.",
        "Em có thể vẽ cây gia đình rồi viết một câu riêng cho từng người, kết hợp tuổi, sở thích và việc thường làm. Với tình bạn, hãy học thêm cách nói giúp đỡ, chia sẻ và giữ liên lạc trong câu hoàn chỉnh. Ôn từ bằng cách tự kể về một người bạn sẽ dễ nhớ hơn chép nhiều lần. Chú ý cousin không tự cho biết giới tính và parents là bố mẹ, khác với relatives là họ hàng.",
      ],
      examples: [{ en: "My cousin shares her books with me.", vi: "Chị họ chia sẻ sách với tôi." }],
    },
    {
      slug: "truong-hoc",
      name: "Trường học và giáo dục",
      summary: "Mở rộng vốn từ về lớp học, môn học, dụng cụ và hoạt động học tập.",
      intro: [
        "Từ vựng trường học xuất hiện khi em đọc thời khóa biểu, nghe hướng dẫn của giáo viên và kể về cách học. Hãy bắt đầu với classroom: phòng học, teacher: giáo viên, student: học sinh, lesson: bài học, subject: môn học, homework: bài tập về nhà, library: thư viện, notebook: vở, timetable: thời khóa biểu, exam: kỳ thi, dictionary: từ điển. Phân biệt lesson là một buổi hoặc phần bài học với subject là lĩnh vực học như toán hay lịch sử.",
        "Thử ghi tên tiếng Anh lên các đồ dùng của em và viết một thời khóa biểu ngắn bằng tiếng Anh. Ghép từ với hành động quen thuộc như do homework, take an exam, borrow a book để học cách dùng tự nhiên. Khi ôn, hãy che phần tiếng Việt và tự mô tả đồ vật hoặc hoạt động. Homework thường không đếm được, vì vậy tránh thêm s hoặc đặt a trực tiếp trước từ này khi nói bài tập nói chung.",
      ],
      examples: [
        {
          en: "We borrow a dictionary from the library.",
          vi: "Chúng tôi mượn một cuốn từ điển ở thư viện.",
        },
      ],
    },
    {
      slug: "am-thuc",
      name: "Ẩm thực",
      summary: "Luyện từ về thực phẩm, đồ uống, bữa ăn và các thao tác nấu nướng.",
      intro: [
        "Chủ đề ẩm thực nối từ vựng với những việc em quan sát được trong bếp và ở bàn ăn. Nhóm từ cốt lõi gồm rice: cơm hoặc gạo, bread: bánh mì, vegetable: rau, fruit: trái cây, milk: sữa, soup: súp hoặc canh, breakfast: bữa sáng, dinner: bữa tối, boil: luộc hoặc đun sôi, bake: nướng bằng lò, oven: lò nướng, ingredient: nguyên liệu. Nghĩa cụ thể đôi khi phụ thuộc món ăn và cách chế biến trong câu.",
        "Hãy viết thực đơn một ngày hoặc đọc một công thức ngắn rồi chia từ thành nguyên liệu, dụng cụ và thao tác. Học boil water, bake bread, slice an onion theo cụm sẽ giúp em kể lại quy trình dễ hơn. Khi gặp danh từ thực phẩm, kiểm tra xem đang nói chất liệu không đếm được hay một suất ăn cụ thể. Em có thể tự kiểm tra bằng cách giải thích bằng tiếng Anh món mình thích mà không nhìn sổ từ.",
      ],
      examples: [
        {
          en: "We bake bread in the small oven.",
          vi: "Chúng tôi nướng bánh mì trong chiếc lò nhỏ.",
        },
      ],
    },
    {
      slug: "du-lich",
      name: "Du lịch và địa điểm",
      summary: "Học từ về chuyến đi, phương tiện, nơi ở và cách tìm đường.",
      intro: [
        "Khi đọc về chuyến đi, em cần nhận ra nơi đến, phương tiện và các dịch vụ dành cho khách. Những từ hữu ích là journey: hành trình, tourist: khách du lịch, ticket: vé, airport: sân bay, station: nhà ga, train: tàu hỏa, bus: xe buýt, hotel: khách sạn, museum: bảo tàng, map: bản đồ, luggage: hành lý, destination: điểm đến. Một địa điểm có thể là nơi tham quan hoặc điểm chuyển tiếp nên hãy chú ý hoạt động diễn ra ở đó.",
        "Em hãy lập kế hoạch một chuyến đi giả định: mua vé ở đâu, đi bằng gì, ngủ tại đâu và muốn thăm nơi nào. Đặt các từ lên một bản đồ nhỏ rồi luyện chỉ đường sẽ giúp gắn từ với vị trí. Học cụm book a room, catch a train, ask for directions thay vì chỉ nhớ danh từ. Luggage thường là danh từ không đếm được; muốn đếm kiện hành lý, dùng a piece of luggage hoặc các từ cụ thể như suitcase.",
      ],
      examples: [
        { en: "The tourists bought tickets at the station.", vi: "Các du khách mua vé ở nhà ga." },
      ],
    },
    {
      slug: "moi-truong",
      name: "Môi trường và thiên nhiên",
      summary: "Tìm hiểu từ về thiên nhiên, thời tiết, tài nguyên và bảo vệ môi trường.",
      intro: [
        "Chủ đề môi trường giúp em đọc về thế giới tự nhiên và những thay đổi do hoạt động con người gây ra. Hãy làm quen với forest: rừng, river: sông, ocean: đại dương, soil: đất, leaf: lá cây, rain: mưa, drought: hạn hán, pollution: ô nhiễm, waste: rác thải, recycle: tái chế, climate: khí hậu, protect: bảo vệ. Weather mô tả thời tiết trong khoảng ngắn, còn climate nói về đặc điểm khí hậu trong thời gian dài ở một khu vực.",
        "Nên học từ theo chuỗi nguyên nhân và kết quả: rác thải gây ô nhiễm, tái chế giúp giảm rác. Em có thể ghi nhật ký thời tiết trong một tuần hoặc viết ba việc bảo vệ sân trường. Khi đọc bài về thiên nhiên, khoanh các từ chỉ vật chất, hành động và hậu quả bằng ba màu khác nhau. Hãy phân biệt save water là tiết kiệm nước với rescue a person là cứu một người trong tình huống nguy hiểm.",
      ],
      examples: [
        {
          en: "Our class recycles paper to reduce waste.",
          vi: "Lớp chúng tôi tái chế giấy để giảm rác thải.",
        },
      ],
    },
    {
      slug: "suc-khoe",
      name: "Sức khỏe và cơ thể",
      summary: "Ôn từ chỉ bộ phận cơ thể, triệu chứng, chăm sóc sức khỏe và thói quen tốt.",
      intro: [
        "Từ vựng sức khỏe giúp em mô tả cơ thể và hiểu những lời khuyên chăm sóc bản thân trong bài đọc. Các từ nền gồm head: đầu, shoulder: vai, knee: đầu gối, heart: tim, tooth: răng, fever: sốt, cough: ho, headache: đau đầu, patient: bệnh nhân, doctor: bác sĩ, medicine: thuốc, exercise: vận động hoặc bài tập. Cùng một từ exercise có thể nói hoạt động thể chất hoặc bài tập học tập nên cần đọc các từ xung quanh.",
        "Em có thể vẽ hình cơ thể và ghi chú tên từng bộ phận, sau đó ghép triệu chứng với câu kể đơn giản. Học have a headache, take medicine, get enough sleep theo cụm giúp em diễn đạt rõ hơn. Chú ý tooth có số nhiều là teeth, foot thành feet, không chỉ thêm s như thông thường. Khi ôn, hãy chia từ thành cơ thể, dấu hiệu bệnh và thói quen để tránh nhầm một triệu chứng với tên người chăm sóc.",
      ],
      examples: [
        { en: "The doctor asked the patient to rest.", vi: "Bác sĩ yêu cầu bệnh nhân nghỉ ngơi." },
      ],
    },
    {
      slug: "khoa-hoc-cong-nghe",
      name: "Khoa học và công nghệ",
      summary: "Khám phá vốn từ về máy tính, mạng, phát minh và nghiên cứu khoa học.",
      intro: [
        "Các bài về khoa học và công nghệ thường kể cách một thiết bị hoạt động hoặc một ý tưởng được kiểm chứng. Em nên biết computer: máy tính, keyboard: bàn phím, screen: màn hình, internet: mạng Internet, software: phần mềm, robot: rô bốt, invention: phát minh, experiment: thí nghiệm, scientist: nhà khoa học, planet: hành tinh, satellite: vệ tinh, energy: năng lượng. Hãy phân biệt vật dụng cụ thể với quá trình nghiên cứu hoặc khái niệm khoa học được nhắc trong đoạn văn.",
        "Thử giải thích bằng vài câu cách gửi một thư điện tử hoặc cách dùng thiết bị học tập của em. Vẽ sơ đồ từ ý tưởng đến thí nghiệm rồi đến kết quả để học nhóm từ nghiên cứu. Ghi cả động từ và danh từ như invent–invention sẽ giúp nhận diện họ từ, nhưng vẫn cần xem vị trí ngữ pháp khi làm bài. Đừng mặc định mọi bài có từ space đều nói vũ trụ: từ ấy cũng có thể chỉ một khoảng trống thông thường.",
      ],
      examples: [
        { en: "The scientist tested a new robot.", vi: "Nhà khoa học thử nghiệm một rô bốt mới." },
      ],
    },
    {
      slug: "the-thao",
      name: "Thể thao và giải trí",
      summary: "Học từ về môn thể thao, trò chơi, âm nhạc, phim ảnh và sở thích.",
      intro: [
        "Thể thao và giải trí gồm cả hoạt động vận động lẫn cách thư giãn sau giờ học. Nhóm từ cơ bản là football: bóng đá, badminton: cầu lông, swimming: bơi lội, team: đội, match: trận đấu, coach: huấn luyện viên, hobby: sở thích, music: âm nhạc, guitar: đàn ghi ta, film: phim, concert: buổi hòa nhạc, audience: khán giả. Match có thể là trận đấu nhưng cũng có nghĩa khác; các từ như team, score và player sẽ giúp em chọn đúng nghĩa.",
        "Hãy làm một lịch hoạt động cuối tuần và viết câu về điều em thích cùng người tham gia. Ghi nhớ play football, go swimming, play the guitar theo cụm vì động từ đi kèm khác nhau. Khi đọc tin thể thao, thử tìm đội tham gia, kết quả và địa điểm; khi đọc về âm nhạc, tìm người biểu diễn và khán giả. Đừng đồng nhất win a match với beat a team: đối tượng đứng sau hai động từ này khác nhau.",
      ],
      examples: [
        {
          en: "Our team won the match on Saturday.",
          vi: "Đội chúng tôi thắng trận đấu vào thứ Bảy.",
        },
      ],
    },
    {
      slug: "cong-viec",
      name: "Công việc và kinh doanh",
      summary: "Làm quen với nghề nghiệp, nơi làm việc, tiền bạc và hoạt động mua bán.",
      intro: [
        "Chủ đề công việc và kinh doanh xuất hiện trong các bài giới thiệu nghề, cửa hàng hoặc cách một công ty phục vụ khách. Em cần biết job: công việc, worker: người lao động, employee: nhân viên, employer: người sử dụng lao động, company: công ty, office: văn phòng, customer: khách hàng, salary: tiền lương, price: giá, sell: bán, buy: mua, business: việc kinh doanh. Employer và employee chỉ hai vai trò khác nhau, dù có phần đầu giống nhau và thường xuất hiện cùng một câu.",
        "Em có thể đóng vai người bán và người mua để luyện hỏi giá, giới thiệu sản phẩm và nói nhu cầu. Học earn money, pay a bill, work for a company trong tình huống cụ thể sẽ dễ dùng hơn dịch từng từ. Khi đọc về nghề nghiệp, ghi lại nơi làm việc, nhiệm vụ và kỹ năng cần có. Work thường không đếm được khi chỉ việc làm nói chung, còn job đếm được nên có thể nói a job hoặc two jobs.",
      ],
      examples: [
        { en: "The company hired two new employees.", vi: "Công ty tuyển hai nhân viên mới." },
      ],
    },
    {
      slug: "dong-vat",
      name: "Động vật",
      summary: "Nhận biết từ về thú nuôi, động vật hoang dã, đặc điểm và môi trường sống.",
      intro: [
        "Học từ về động vật giúp em đọc những bài kể chuyện, mô tả thú nuôi và tìm hiểu đời sống hoang dã. Hãy bắt đầu với cat: mèo, dog: chó, rabbit: thỏ, elephant: voi, tiger: hổ, whale: cá voi, bird: chim, bee: ong, wing: cánh, tail: đuôi, nest: tổ, habitat: môi trường sống. Khi gặp một loài chưa biết, các chi tiết về thức ăn, bộ phận cơ thể và nơi sinh sống thường giúp em suy ra nhóm động vật đó.",
        "Thay vì học một danh sách dài, hãy lập thẻ cho từng con vật gồm hình vẽ, tên và hai đặc điểm. Chia chúng thành thú nuôi, động vật trang trại và động vật hoang dã, rồi thử mô tả mà không nói tên để bạn đoán. Chú ý sheep có dạng số ít và số nhiều giống nhau, còn mouse có số nhiều là mice. Học thêm động từ như feed và hatch trong câu sẽ giúp em hiểu hoạt động của con vật.",
      ],
      examples: [
        {
          en: "A small bird built a nest above our window.",
          vi: "Một con chim nhỏ làm tổ phía trên cửa sổ nhà chúng tôi.",
        },
      ],
    },
  ],
};
export function getTopicDef(skill: string, slug: string): TopicDef | undefined {
  if (skill !== "ngu-phap" && skill !== "tu-vung") return undefined;
  return TOPIC_REGISTRY[skill].find((topic) => topic.slug === slug);
}
export function isConcreteTopic(skill: string, slug: string): boolean {
  return getTopicDef(skill, slug) !== undefined;
}
/** Stable for unregistered skills; mixed topics always appear last. */
export function topicOrder(skill: string, slug: string): number {
  if (slug === "tong-hop") return Number.MAX_SAFE_INTEGER;
  if (skill !== "ngu-phap" && skill !== "tu-vung") return 0;
  const index = TOPIC_REGISTRY[skill].findIndex((t) => t.slug === slug);
  return index < 0 ? TOPIC_REGISTRY[skill].length : index;
}
